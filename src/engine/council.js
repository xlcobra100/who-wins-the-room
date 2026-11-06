/**
 * The Council: orchestrates turns, memory, interventions and votes.
 *
 * Turn pipeline: pick speaker (director) → generate (model or offline) →
 * commit (stance, thought, trust, whisper bookkeeping, everyone observes) →
 * play back (UI-injected: subtitles/TTS/3D) → next. While one turn plays, the
 * next is generated in the background ("prefetch") to hide model latency.
 *
 * Interventions (gavel / crisis / vote) bump `epoch`, abort in-flight
 * generations and interrupt playback, so a stale prefetched turn can never be
 * committed after the room has changed. A whisper only cancels the prefetch of
 * its target (so the target's next turn sees the new idea).
 *
 * Playback contract: `council.playback = async (entry) => {}` resolves when the
 * entry has been shown/spoken; `council.interruptPlayback = () => {}` cuts it short.
 */
import { Emitter } from './emitter.js';
import { MemoryStream, clamp } from './memory.js';
import { pickNextSpeaker, detectMentions, addressesEveryone, resolveAddressee, pickCrisisResponders } from './director.js';
import {
  buildSystemPrompt, buildTurnPrompt, turnSchema, buildVotePrompt, VOTE_SCHEMA,
  chronicleSystem, buildEpiloguePrompt, EPILOGUE_SCHEMA,
} from './prompts.js';
import { offlineTurn, offlineBallot, offlineEpilogue, overlap, inferFavors } from './offline.js';
import { INITIAL_TRUST, EMOTIONS } from '../data/personas.js';

// Fourth-wall breaks are never allowed onto the table; such a turn is regenerated offline.
const BREAK_RE = /\b(as an ai|an ai (language )?model|language model|i am an ai|i'm an ai|as a (large )?language|this (simulation|role-?play)|role-?play(ing)?|my (programming|prompt|instructions))\b/i;

export class Council extends Emitter {
  constructor({ scenario, personas, llm = null, speed = 1, mode = 'council', debaters = null, debateOptions = null }) {
    super();
    this.scenario = scenario;
    this.llm = llm;
    this.speed = speed;
    this.mode = mode; // 'council' | 'debate'
    this.debaters = debaters || (personas.length >= 2 ? [personas[0].id, personas[personas.length - 1].id] : []);
    this.debateOptions = debateOptions || (scenario.options.length >= 2 ? [scenario.options[0].id, scenario.options[1].id] : ['A', 'B']);
    this.recentSpeakers = [];
    this.agentList = personas.map((p, seat) => ({
      id: p.id,
      seat,
      persona: p,
      memory: new MemoryStream(p.id, personas.filter((q) => q.id !== p.id).map((q) => q.id), INITIAL_TRUST[p.id] || {}),
      emotion: 'calm',
      status: 'idle',
      lastSpokeTurn: null,
      spoken: 0,
      ballot: null,
      isDebater: this.mode === 'debate' && this.debaters.includes(p.id),
    }));
    this.agents = new Map(this.agentList.map((a) => [a.id, a]));
    for (const a of this.agentList) {
      const st = scenario.stances?.[a.id];
      if (st) { a.memory.setStance(0, st.position, st.conviction); a.memory.think(0, st.thought); }
    }
    // In debate mode, initialize the two debaters on their champion positions with high conviction
    if (this.mode === 'debate' && this.debaters.length === 2) {
      const d1 = this.agents.get(this.debaters[0]);
      const d2 = this.agents.get(this.debaters[1]);
      if (d1) {
        d1.memory.setStance(0, this.debateOptions[0], 85);
        d1.memory.think(0, `I will defend ${this.scenario.options.find((o) => o.id === this.debateOptions[0])?.label || this.debateOptions[0]} with everything I have.`);
      }
      if (d2) {
        d2.memory.setStance(0, this.debateOptions[1], 85);
        d2.memory.think(0, `I stand firmly against ${d1?.persona.short || 'the opponent'}; ${this.scenario.options.find((o) => o.id === this.debateOptions[1])?.label || this.debateOptions[1]} is our only way.`);
      }
    }
    this.transcript = [];
    this.turn = 0;
    this.tension = scenario.tension ?? 40;
    this.phase = 'debate'; // 'debate' | 'vote' | 'ended'
    this.auto = false;
    this.queue = [];
    this.epoch = 0;
    this.pending = new Set();
    this.prefetch = null;
    this.pumping = false;
    this.pumpDone = Promise.resolve();
    this.forceOne = false;
    this.failures = 0;
    this.seq = 0;
    this.whisperSeq = 0;
    this.started = false;
    this.lastVote = null;
    this.offlineDelay = 1; // scales the offline engine's fake thinking pause (tests set 0)
    this.playback = async () => {};
    this.interruptPlayback = () => {};
  }

  get offline() { return !this.llm || this.llm.settings.engine === 'offline'; }

  nameOf(id) {
    if (id === 'chair') return 'The Chair';
    return this.agents.get(id)?.persona.name || id;
  }

  lastSpeech() {
    for (let i = this.transcript.length - 1; i >= 0; i--) if (this.transcript[i].kind === 'speech') return this.transcript[i];
    return null;
  }

  consensus() {
    const counts = Object.fromEntries([...this.scenario.options.map((o) => o.id), 'undecided'].map((k) => [k, []]));
    for (const a of this.agentList) (counts[a.memory.stance.position] || counts.undecided).push(a.id);
    return counts;
  }

  // ------------------------------------------------------------------ lifecycle
  start() {
    if (this.started) return;
    this.started = true;
    if (this.mode === 'debate') {
      const d1 = this.agents.get(this.debaters[0]);
      const d2 = this.agents.get(this.debaters[1]);
      this.push({
        kind: 'system',
        text: `Debate Arena convened: ${d1?.persona.name} vs ${d2?.persona.name} on "${this.scenario.title}". Five council members preside as audience jury.`,
      });
      this.queue.push({ speakerId: this.debaters[0], moment: { kind: 'open' } });
    } else {
      this.push({ kind: 'system', text: `Session convened: ${this.scenario.title}. ${this.scenario.brief}` });
      const opener = this.agents.has(this.scenario.opener) ? this.scenario.opener : this.agentList[0].id;
      this.queue.push({ speakerId: opener, moment: { kind: 'open' } });
    }
    this.emitState();
  }

  play() {
    if (this.phase === 'ended') return;
    this.auto = true;
    this.emit('auto', true);
    this.pump();
  }

  pause() {
    this.auto = false;
    this.emit('auto', false);
  }

  step() {
    if (this.phase !== 'debate') return;
    this.forceOne = true;
    this.pump();
  }

  setSpeed(v) { this.speed = clamp(v, 0.25, 4); }

  destroy() {
    this.phase = 'ended';
    this.auto = false;
    this.cancelPending();
    this.interruptPlayback();
  }

  pump() {
    if (this.pumping) return this.pumpDone;
    this.pumping = true;
    this.pumpDone = (async () => {
      try {
        while (this.phase === 'debate' && (this.auto || this.queue.length || this.forceOne)) {
          this.forceOne = false;
          const ok = await this.advance();
          if (this.phase !== 'debate') break;
          if (!ok) { await sleep(120); continue; }
          if (this.auto || this.queue.length) await sleep(this.gapMs());
        }
      } catch (e) {
        console.error('[halcyon] pump failed', e);
        this.emit('notice', { level: 'error', text: `Debate loop error: ${e.message}` });
      } finally {
        this.pumping = false;
        this.emit('idleLoop');
      }
    })();
    return this.pumpDone;
  }

  gapMs() { return 650 / this.speed; }

  // ------------------------------------------------------------------ turns
  async advance() {
    let job = null;
    const head = this.queue[0];
    if (this.prefetch && this.prefetch.epoch === this.epoch
      && (head ? this.prefetch.queued && this.prefetch.speakerId === head.speakerId : !this.prefetch.queued)) {
      job = this.prefetch;
      if (head) this.queue.shift();
    } else {
      this.cancelPrefetch();
      if (head) {
        this.queue.shift();
        job = this.makeJob(head.speakerId, head.moment, true);
      } else {
        const next = pickNextSpeaker(this);
        job = this.makeJob(next.id, { kind: this.lastSpeech() ? 'react' : 'open' }, false);
      }
    }
    this.prefetch = null;
    const agent = this.agents.get(job.speakerId);
    agent.status = 'thinking';
    this.emit('thinking', { agentId: agent.id, moment: job.moment });
    const result = await job.promise;
    if (job.epoch !== this.epoch || !result || this.phase !== 'debate') {
      agent.status = 'idle';
      this.emit('idle', { agentId: agent.id });
      return false;
    }
    const entry = this.commitTurn(agent, job.moment, result);
    // Generate the following turn while this one is being performed.
    if (this.phase === 'debate') {
      const nextHead = this.queue[0];
      if (nextHead) this.prefetch = this.makeJob(nextHead.speakerId, nextHead.moment, true);
      else if (this.auto) this.prefetch = this.makeJob(pickNextSpeaker(this).id, { kind: 'react' }, false);
    }
    agent.status = 'speaking';
    await this.perform(entry);
    agent.status = 'idle';
    this.emit('idle', { agentId: agent.id });
    return true;
  }

  async perform(entry) {
    try { await this.playback(entry); } catch (e) { console.error('[halcyon] playback failed', e); }
  }

  makeJob(speakerId, moment, queued) {
    const agent = this.agents.get(speakerId);
    const ac = new AbortController();
    this.pending.add(ac);
    const promise = this.generateTurn(agent, moment, ac.signal).finally(() => this.pending.delete(ac));
    return { speakerId, moment, queued, promise, epoch: this.epoch, ac };
  }

  cancelPending() {
    this.epoch++;
    for (const ac of this.pending) ac.abort();
    this.pending.clear();
    this.prefetch = null;
  }

  cancelPrefetch() {
    if (this.prefetch) { this.prefetch.ac.abort(); this.prefetch = null; }
  }

  /** Never rejects: returns a turn result, or null if aborted. */
  async generateTurn(agent, moment, signal) {
    if (this.offline) {
      await sleep((450 + Math.random() * 650) * this.offlineDelay, signal);
      if (signal.aborted) return null;
      return { ...offlineTurn(agent, this, moment), source: 'offline' };
    }
    try {
      const json = await this.llm.generate({
        system: buildSystemPrompt(agent, this),
        prompt: buildTurnPrompt(agent, this, moment),
        schema: turnSchema(this, agent),
        maxTokens: 500,
        signal,
      });
      if (signal.aborted) return null;
      let norm = this.normalizeTurn(agent, json);
      if (!norm) throw new Error('the reply broke character or was empty');
      // Small local models sometimes repeat their own earlier line nearly word
      // for word. Ask once more for something new; keep the first reply if the
      // retry fails.
      const echo = this.echoOf(agent, norm.speech);
      if (echo) {
        const retry = await this.llm.generate({
          system: buildSystemPrompt(agent, this),
          prompt: `${buildTurnPrompt(agent, this, moment)}\n\nYou already said almost exactly this earlier: "${echo}". Say something new this time: a different point, question or proposal.`,
          schema: turnSchema(this, agent),
          maxTokens: 500,
          signal,
        }).catch(() => null);
        if (signal.aborted) return null;
        norm = (retry && this.normalizeTurn(agent, retry)) || norm;
      }
      this.failures = 0;
      return { ...norm, source: 'llm' };
    } catch (e) {
      if (signal.aborted || e.name === 'AbortError') return null;
      return this.fallbackTurn(agent, moment, e);
    }
  }

  fallbackTurn(agent, moment, err) {
    this.failures++;
    this.emit('notice', { level: 'warn', text: `${agent.persona.short}'s turn used scripted lines (${err.message}).` });
    if (this.failures >= 3 && this.llm && this.llm.settings.engine !== 'offline') {
      this.llm.settings.engine = 'offline';
      this.emit('engine', 'offline');
      this.emit('notice', { level: 'error', text: 'The model keeps failing, so the council switched to the offline scripted engine. Switch back in Settings.' });
    }
    return { ...offlineTurn(agent, this, moment), source: 'offline' };
  }

  /** One of this agent's last three lines that `speech` nearly repeats (word-set overlap), or null. */
  echoOf(agent, speech) {
    const words = (t) => new Set(t.toLowerCase().match(/[a-z']{3,}/g) || []);
    const mine = words(speech);
    if (mine.size < 5) return null;
    const recent = this.transcript.filter((e) => e.kind === 'speech' && e.speakerId === agent.id).slice(-3);
    for (const e of recent) {
      const theirs = words(e.text);
      let shared = 0;
      for (const w of mine) if (theirs.has(w)) shared++;
      if (shared / (mine.size + theirs.size - shared) > 0.55) return e.text;
    }
    return null;
  }

  normalizeTurn(agent, json) {
    if (!json || typeof json !== 'object') return null;
    const speech = nameOptions(sanitizeSpeech(json.speech), this.scenario);
    if (!speech || BREAK_RE.test(speech)) return null;
    const ids = this.scenario.options.map((o) => o.id);
    const position = ids.includes(json.position) || json.position === 'undecided' ? json.position : agent.memory.stance.position;
    const c = parseInt(json.conviction, 10);
    const thought = sanitizeSpeech(json.inner_thought, 3, 60) || agent.memory.latestThought();
    const trust_shift = (Array.isArray(json.trust_shift) ? json.trust_shift : [])
      .map((t) => ({ id: resolveAddressee(String(t?.name || ''), this.agentList, agent.id), delta: clamp(parseInt(t?.delta, 10) || 0, -10, 10) }))
      .filter((t) => t.id && t.id !== 'chair' && t.delta);
    return {
      speech,
      inner_thought: BREAK_RE.test(thought) ? agent.memory.latestThought() : thought,
      position,
      conviction: Number.isFinite(c) ? clamp(c, 0, 100) : agent.memory.stance.conviction,
      emotion: EMOTIONS.includes(json.emotion) ? json.emotion : 'calm',
      addressing: typeof json.addressing === 'string' ? json.addressing : '',
      trust_shift,
      used_whisper: json.used_whisper === true,
      rhetoric: ['logos', 'pathos', 'ethos', 'pragmatism'].includes(json.rhetoric) ? json.rhetoric : 'logos',
    };
  }

  commitTurn(agent, moment, r) {
    const before = this.lastSpeech();
    this.turn++;
    const mem = agent.memory;
    const prevPosition = mem.stance.position;
    const prevConviction = mem.stance.conviction;
    mem.setStance(this.turn, r.position, r.conviction);
    mem.think(this.turn, r.inner_thought);
    agent.emotion = r.emotion;
    agent.lastSpokeTurn = this.turn;
    agent.spoken++;
    const addressingId = resolveAddressee(r.addressing, this.agentList, agent.id) || (moment.kind === 'chair' ? 'chair' : null);
    for (const t of r.trust_shift || []) mem.shiftTrust(t.id, t.delta, this.turn);

    const w = mem.activeWhisper(this.turn);
    let championed = false;
    if (w && !w.used && (r.used_whisper || overlap(r.speech, w.text) >= 2)) {
      w.used = true;
      w.usedTurn = this.turn;
      championed = true;
    }
    if (w && w.used && w.usedTurn !== this.turn && overlap(r.speech, w.text) >= 2) w.mentions++;

    this.recentSpeakers.push(agent.id);
    if (this.recentSpeakers.length > 8) this.recentSpeakers.shift();

    const rhetoric = r.rhetoric || 'logos';
    const sways = [];

    // In Debate Mode: calculate audience sway across the 5 listening jury members!
    if (this.mode === 'debate' && this.debaters.includes(agent.id)) {
      for (const o of this.agentList) {
        if (this.debaters.includes(o.id)) continue; // debaters hold ground
        const tr = o.persona.traits || { openness: 0.5, persuadability: 0.5, assertiveness: 0.6, compromise: 0.5 };
        const bias = (o.persona.rhetoricBias?.[rhetoric] ?? 1.0) * (0.6 + tr.openness * 0.8);
        const basePotency = (r.conviction / 100) * 8 + 4;
        const delta = Math.round(basePotency * bias);
        const currPos = o.memory.stance.position;
        const currConv = o.memory.stance.conviction;

        if (currPos === r.position) {
          // Already on the same side: strengthen conviction
          o.memory.stance.conviction = clamp(currConv + delta, 5, 98);
          sways.push({ listenerId: o.id, name: o.persona.short, debaterId: agent.id, rhetoric, delta, flipped: false, newPos: currPos, reason: `${rhetoric.toUpperCase()} reinforced conviction` });
        } else if (bias >= 1.15) {
          // Rhetoric strongly resonated with this listener's moral values
          const newConv = currConv - delta;
          const flipThreshold = 25 + Math.round(tr.persuadability * 20);
          if (newConv <= flipThreshold || currPos === 'undecided') {
            // Persuaded to flip sides!
            o.memory.stance.position = r.position;
            o.memory.stance.conviction = clamp(48 + Math.round(delta * 1.4 * tr.persuadability), 10, 95);
            sways.push({ listenerId: o.id, name: o.persona.short, debaterId: agent.id, rhetoric, delta, flipped: true, newPos: r.position, reason: `${rhetoric.toUpperCase()} swayed allegiance` });
          } else {
            o.memory.stance.conviction = clamp(newConv, 5, 98);
            sways.push({ listenerId: o.id, name: o.persona.short, debaterId: agent.id, rhetoric, delta: -delta, flipped: false, newPos: currPos, reason: `${rhetoric.toUpperCase()} eroded opposition` });
          }
        } else if (bias < 0.75) {
          // Rhetoric alienated this listener (backfire)
          o.memory.stance.conviction = clamp(currConv + 5, 5, 98);
          sways.push({ listenerId: o.id, name: o.persona.short, debaterId: agent.id, rhetoric, delta: -5, backfired: true, newPos: currPos, reason: `${rhetoric.toUpperCase()} backfired` });
        } else {
          // Moderate effect
          const d = Math.round(delta * 0.5 * tr.openness);
          o.memory.stance.conviction = clamp(currConv - d, 5, 98);
          sways.push({ listenerId: o.id, name: o.persona.short, debaterId: agent.id, rhetoric, delta: d, flipped: false, newPos: currPos, reason: `${rhetoric.toUpperCase()} tested resolve` });
        }
      }
    }

    const entry = this.push({
      kind: 'speech', speakerId: agent.id, text: r.speech, thought: r.inner_thought,
      position: r.position, prevPosition, conviction: mem.stance.conviction, prevConviction,
      emotion: r.emotion, addressingId, moment: moment.kind, championed,
      whisperText: championed ? w.text : null, source: r.source,
      rhetoric, sways: sways.length ? sways : undefined,
    });

    if (sways.length) this.emit('sway', { entry, sways });

    mem.observe({ turn: this.turn, kind: 'self', who: agent.id, text: r.speech });
    for (const o of this.agentList) {
      if (o === agent) continue;
      o.memory.observe({ turn: this.turn, kind: 'speech', who: agent.id, text: r.speech });
      // Listeners' private affinity drifts too: allies warm, opponents cool, direct hostility stings.
      const same = o.memory.stance.position === r.position;
      let d = same ? 2 : -1;
      if (addressingId === o.id) d += same ? 2 : -2;
      o.memory.shiftTrust(agent.id, d, this.turn);
      if (this.offline && !same && (o.memory.trust[agent.id] ?? 0) > 30) {
        o.memory.stance.conviction = clamp(o.memory.stance.conviction - 3, 5, 98);
      }
    }

    const heat = { angry: 4, defiant: 3, anxious: 2, grieved: 1, resolute: 0.5, wry: 0, calm: -2, hopeful: -2.5 }[r.emotion] ?? 0;
    const clash = before && before.position !== r.position ? 1.5 : -1;
    const drift = this.tension > 45 ? -0.8 : 0.5;
    this.setTension(this.tension + heat + clash + drift);
    this.emit('speech', entry);
    this.emitState();
    return entry;
  }

  push(e) {
    const entry = { id: ++this.seq, turn: this.turn, at: Date.now(), ...e };
    this.transcript.push(entry);
    this.emit('entry', entry);
    return entry;
  }

  setTension(v) { this.tension = clamp(Math.round(v * 10) / 10, 0, 100); }

  updateAgentTrait(agentId, traitKey, value) {
    const a = this.agents.get(agentId);
    if (!a) return;
    if (!a.persona.traits) a.persona.traits = { openness: 0.5, persuadability: 0.5, assertiveness: 0.6, compromise: 0.5 };
    a.persona.traits[traitKey] = clamp(value, 0.05, 0.95);
    this.emit('traitChange', { agentId, traits: a.persona.traits });
  }

  emitState() { this.emit('state', { turn: this.turn, tension: this.tension, phase: this.phase }); }

  // ------------------------------------------------------------------ interventions
  /** Moderator gavel: the Chair speaks; addressed members (or the best responder) answer next. */
  gavel(text, targetId = null) {
    if (this.phase !== 'debate') return null;
    const line = (text || '').trim() || 'Order. Order in the chamber.';
    this.cancelPending();
    this.interruptPlayback();
    this.setTension(this.tension - 6);
    const mentions = targetId ? [targetId] : detectMentions(line, this.agentList);
    const all = !targetId && addressesEveryone(line);
    const entry = this.push({ kind: 'chair', text: line, targetIds: mentions, all });
    for (const a of this.agentList) a.memory.observe({ turn: this.turn, kind: 'chair', text: line });
    const responders = all ? this.agentList.map((a) => a.id) : mentions.length ? mentions : [pickNextSpeaker(this).id];
    this.queue = responders.map((id) => ({ speakerId: id, moment: { kind: 'chair', text: line, targeted: !all && mentions.includes(id), all } }));
    this.emit('chair', entry);
    this.emitState();
    this.pump();
    return entry;
  }

  /** Crisis shock: a mid-debate emergency every member learns at once; the most affected react first. */
  crisis({ title, text, severity = 2, shift = {} }) {
    if (this.phase !== 'debate') return null;
    this.cancelPending();
    this.interruptPlayback();
    const sev = clamp(severity, 1, 3);
    this.setTension(this.tension + 10 * sev);
    const entry = this.push({ kind: 'crisis', title, text, severity: sev, shift });
    const responders = pickCrisisResponders(this, shift, sev >= 3 ? 3 : 2);
    for (const a of this.agentList) {
      a.memory.observe({ turn: this.turn, kind: 'crisis', title, text });
      const d = shift[a.memory.stance.position];
      if (this.offline && d && !responders.includes(a.id)) a.memory.stance.conviction = clamp(a.memory.stance.conviction + d * 0.5, 5, 98);
    }
    this.queue = responders.map((id) => ({ speakerId: id, moment: { kind: 'crisis', title, text, shift } }));
    this.emit('crisis', entry);
    this.emitState();
    this.pump();
    return entry;
  }

  /** Public Carrier Dispatch: breaking station intelligence delivered via a carrier drone that EVERY member sees and hears simultaneously. */
  carrierDispatch({ title, text, severity = 2, favors = null, shift = {} }) {
    if (this.phase !== 'debate') return null;
    this.cancelPending();
    this.interruptPlayback();
    const cleanTitle = (title || 'Carrier Dispatch').trim();
    const cleanText = (text || '').trim();
    const sev = clamp(severity, 1, 3);
    const fav = favors || inferFavors(`${cleanTitle} ${cleanText}`, this.scenario);
    this.setTension(this.tension + 6 * sev);
    const entry = this.push({ kind: 'carrier', title: cleanTitle, text: cleanText, severity: sev, favors: fav, shift });
    for (const a of this.agentList) {
      a.memory.observe({ turn: this.turn, kind: 'carrier', title: cleanTitle, text: cleanText, favors: fav });
      if (fav && this.offline) {
        if (a.memory.stance.position === fav) {
          a.memory.stance.conviction = clamp(a.memory.stance.conviction + 12 * sev, 5, 98);
        } else {
          a.memory.stance.conviction = clamp(a.memory.stance.conviction - 8 * sev, 5, 98);
        }
      }
    }
    const nextSpeaker = pickNextSpeaker(this);
    this.queue = [{ speakerId: nextSpeaker.id, moment: { kind: 'carrier', title: cleanTitle, text: cleanText, favors: fav, shift } }];
    this.emit('carrier', entry);
    this.emitState();
    this.pump();
    return entry;
  }

  /** Confidential whisper: implant an idea in one agent's private memory. Never shown to the table. */
  whisper(agentId, text, favors = undefined) {
    const a = this.agents.get(agentId);
    const clean = (text || '').trim();
    if (!a || !clean || this.phase === 'ended') return null;
    const fav = favors !== undefined ? favors : inferFavors(clean, this.scenario);
    a.memory.implant({ id: ++this.whisperSeq, turn: this.turn, text: clean, favors: fav });
    if (this.prefetch?.speakerId === agentId) this.cancelPrefetch();
    const entry = this.push({ kind: 'whisper', speakerId: agentId, text: clean, private: true });
    this.emit('whisper', entry);
    this.emitState();
    return entry;
  }

  /** Formal binding vote. motion = { text, optionId? } */
  async callVote(motion) {
    if (this.phase !== 'debate' || !motion?.text) return null;
    this.phase = 'vote';
    this.cancelPending();
    this.interruptPlayback();
    this.auto = false;
    this.emit('auto', false);
    this.queue = [];
    await this.pumpDone;
    const epoch = this.epoch;

    const call = this.push({ kind: 'chair', text: `Order. The Chair calls a formal, binding vote on the motion: ${motion.text}`, vote: true });
    for (const a of this.agentList) a.memory.observe({ turn: this.turn, kind: 'chair', text: call.text });
    this.emit('chair', call);
    this.emit('voteStart', { motion });

    const ac = new AbortController();
    this.pending.add(ac);
    const results = await Promise.all(this.agentList.map((a) => this.generateBallot(a, motion, ac.signal)
      .then((r) => { this.emit('ballotReady', { agentId: a.id }); return r; })));
    this.pending.delete(ac);
    if (epoch !== this.epoch || this.phase !== 'vote') return null;

    const ballots = [];
    for (let i = 0; i < this.agentList.length; i++) {
      const a = this.agentList[i];
      const r = results[i];
      a.ballot = r.vote;
      a.memory.think(this.turn, r.inner_thought);
      const entry = this.push({ kind: 'ballot', speakerId: a.id, vote: r.vote, text: r.rationale, thought: r.inner_thought, source: r.source });
      for (const o of this.agentList) o.memory.observe({ turn: this.turn, kind: 'ballot', who: a.id, vote: r.vote, text: r.rationale });
      ballots.push(entry);
      a.status = 'speaking';
      this.emit('ballot', entry);
      await this.perform(entry);
      a.status = 'idle';
      this.emit('idle', { agentId: a.id });
      if (epoch !== this.epoch) return null;
      await sleep(300 / this.speed);
    }
    const tally = {
      aye: ballots.filter((b) => b.vote === 'AYE').length,
      nay: ballots.filter((b) => b.vote === 'NAY').length,
      abstain: ballots.filter((b) => b.vote === 'ABSTAIN').length,
    };
    tally.passed = tally.aye > tally.nay;
    this.emit('tallying', { tally, motion });
    const epilogue = await this.generateEpilogue(motion, tally, ballots);
    if (epoch !== this.epoch) return null;
    const text = `${tally.passed ? 'PASSED' : 'FAILED'} ${tally.aye}–${tally.nay}–${tally.abstain}: ${motion.text}`;
    const entry = this.push({ kind: 'vote', motion, tally, epilogue, text });
    for (const a of this.agentList) a.memory.observe({ turn: this.turn, kind: 'vote', text });
    this.lastVote = entry;
    this.setTension(this.tension + (tally.passed ? -15 : 8));
    this.phase = 'debate';
    this.emit('voteResult', entry);
    this.emitState();
    return entry;
  }

  applyAftermath({ outcomeId, outcomeTitle, outcomeDesc, hoursLater = 5 }) {
    this.epoch++;
    this.interruptPlayback();
    this.cancelPending();

    const h = Number(hoursLater) || 5;
    this.scenario.clock = `${h} hrs post-vote · ${this.scenario.clock || 'Session in progress'}`;

    let tensionDelta = 0;
    if (outcomeId === 'total_failure') tensionDelta = +35;
    else if (outcomeId === 'pyrrhic') tensionDelta = +15;
    else if (outcomeId === 'fragile_truce') tensionDelta = +5;
    else if (outcomeId === 'breakthrough') tensionDelta = -20;

    this.setTension(this.tension + tensionDelta);

    const title = `REASSEMBLING ${h} HOURS LATER: ${outcomeTitle.toUpperCase()}`;
    const bannerText = `${h} hours have elapsed since the gavel fell. Fallout: ${outcomeDesc}`;

    const entry = this.push({
      kind: 'reassemble',
      title,
      text: bannerText,
      outcomeId,
      hoursLater: h,
      severity: outcomeId === 'total_failure' ? 3 : 2,
    });

    for (const a of this.agentList) {
      const votedAye = a.ballot === 'AYE';
      if (outcomeId === 'total_failure') {
        if (!votedAye) {
          a.memory.think(this.turn, `I warned this room five hours ago. Now look at the wreckage: ${outcomeTitle}. They have blood on their hands.`);
        } else {
          a.memory.think(this.turn, `Five hours later and it collapsed into total failure. I have to protect myself before the blame lands on me.`);
        }
      } else if (outcomeId === 'breakthrough') {
        if (votedAye) {
          a.memory.think(this.turn, `Vindicated. Five hours later, the order holds and the doubters are silenced.`);
        } else {
          a.memory.think(this.turn, `It worked... for now. But the fundamental risks remain.`);
        }
      } else {
        a.memory.think(this.turn, `Five hours later, the emergency reconvenes under ${outcomeTitle}. Nobody is satisfied.`);
      }
      a.memory.observe({ turn: this.turn, kind: 'reassemble', text: `${title}: ${outcomeDesc}` });
    }

    const dissenters = this.agentList.filter((a) => outcomeId === 'total_failure' ? a.ballot !== 'AYE' : a.ballot === 'AYE');
    const firstSpeaker = (dissenters[0] || this.agentList[0]).id;
    this.queue = [{ speakerId: firstSpeaker, moment: { kind: 'crisis', title, text: bannerText } }];

    this.emit('reassemble', { entry, outcomeId, hoursLater: h, title, text: bannerText });
    this.emitState();
    if (this.auto) this.pump();
    return entry;
  }

  clearBallots() { for (const a of this.agentList) a.ballot = null; }

  async generateBallot(agent, motion, signal) {
    if (this.offline) {
      await sleep((250 + Math.random() * 700) * this.offlineDelay, signal);
      return { ...offlineBallot(agent, this, motion), source: 'offline' };
    }
    try {
      const json = await this.llm.generate({
        system: buildSystemPrompt(agent, this),
        prompt: buildVotePrompt(agent, this, motion),
        schema: VOTE_SCHEMA,
        maxTokens: 300,
        signal,
      });
      const vote = ['AYE', 'NAY', 'ABSTAIN'].includes(json?.vote) ? json.vote : null;
      const rationale = nameOptions(sanitizeSpeech(json?.rationale, 2, 45), this.scenario);
      if (!vote || !rationale || BREAK_RE.test(rationale)) throw new Error('unusable ballot');
      return { vote, rationale, inner_thought: sanitizeSpeech(json.inner_thought, 2, 50) || '', source: 'llm' };
    } catch (e) {
      if (signal.aborted) return { ...offlineBallot(agent, this, motion), source: 'offline' };
      this.emit('notice', { level: 'warn', text: `${agent.persona.short}'s ballot used scripted lines (${e.message}).` });
      return { ...offlineBallot(agent, this, motion), source: 'offline' };
    }
  }

  async generateEpilogue(motion, tally, ballots) {
    if (this.offline) return offlineEpilogue(this, motion, tally);
    try {
      const json = await this.llm.generate({
        system: chronicleSystem(this.scenario),
        prompt: buildEpiloguePrompt(this, motion, tally, ballots),
        schema: EPILOGUE_SCHEMA,
        maxTokens: 400,
      });
      if (!json?.headline || !json?.epilogue) throw new Error('empty epilogue');
      return { headline: String(json.headline).slice(0, 80), epilogue: String(json.epilogue) };
    } catch {
      return offlineEpilogue(this, motion, tally);
    }
  }
}

/**
 * Keep spoken lines clean: no name labels, stage directions or wrapping quotes,
 * and at most `maxSentences` sentences / roughly `maxWords` words.
 */
export function sanitizeSpeech(text, maxSentences = 3, maxWords = 75) {
  if (typeof text !== 'string') return '';
  let s = text.replace(/\r?\n+/g, ' ').trim();
  s = s.replace(/^\s*(\*\*)?[A-Z][\w.'" -]{1,40}(\*\*)?\s*:\s+/, '');
  s = s.replace(/\*[^*]{1,80}\*/g, ' ').replace(/\([^)]{1,60}\)/g, (m) => (/^\((sighs?|leans|pauses?|laughs?|smiles?|frowns?|nods?|shakes)/i.test(m) ? ' ' : m));
  s = s.replace(/\[[^\]]{1,60}\]/g, ' ');
  s = s.replace(/["“”]/g, '').replace(/^'+|'+$/g, '').replace(/\s{2,}/g, ' ').trim();
  // Titles and initials ("Mr.", "U. S. Steel", "J. P. Morgan") are not sentence
  // ends: hide their dots while splitting, or the line gets cut mid-name.
  s = s.replace(/\b(Mr|Mrs|Ms|Dr|St|Prof|Col|Gen|Capt|Sen|Rev|Jr|Sr|vs|etc)\.|\b[A-Z]\.(?=\s?[A-Z])/g, (m) => m.replace('.', '․'));
  const sentences = s.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) || [s];
  let out = '';
  let words = 0;
  for (const raw of sentences.slice(0, maxSentences)) {
    const sent = raw.trim();
    const n = sent.split(/\s+/).length;
    if (out && words + n > maxWords) break;
    out += (out ? ' ' : '') + sent;
    words += n;
  }
  return out.replace(/․/g, '.').trim();
}

/**
 * Small local models often say "Option C" despite being told not to. Swap letter
 * references for the option's name ("the Strip the Refinery option") and make
 * sure every sentence starts with a capital letter.
 */
export function nameOptions(text, scenario) {
  if (!text) return text;
  const out = text.replace(/\b(?:option|plan|choice)\s+([A-D])\b/gi, (m, id) => {
    const o = scenario.options.find((x) => x.id === id.toUpperCase());
    return o ? `the ${o.label} option` : m;
  });
  return out.replace(/(^|[.!?]\s+)([a-z])/g, (m, p, c) => p + c.toUpperCase());
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
