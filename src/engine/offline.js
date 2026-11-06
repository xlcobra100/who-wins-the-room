/**
 * Offline scripted cognition: a model-free stand-in that keeps the council
 * playable (and in character) with no GPU, no Ollama and no API key. It is also
 * the per-turn fallback when a model call fails mid-session.
 *
 * Each turn is assembled from three beats: a persona-voiced reaction (to the
 * last speaker, the Chair or an alert), one substantive sentence (an implanted
 * whisper, a change of heart, an attack on the rival option, or the case for
 * their own), and sometimes a signature closer. Stance, trust and emotion evolve
 * with simple social rules so votes still mean something.
 */
import { clamp } from './memory.js';

const SHIFT_LINES = ['I\'ll admit it: I\'ve moved.', 'I\'ve changed my mind.', 'Fine. I\'m persuaded.', 'I was wrong earlier.'];
const HURT_LINES = ['That makes my case harder, not wrong.', 'It cuts against me. I still hold my ground.'];
const HELP_LINES = ['If anything, this proves my point.', 'This is exactly why I said what I said.'];

export function pickLine(arr, mem) {
  if (!arr || !arr.length) return '';
  const fresh = mem ? arr.filter((x) => !mem.usedLines.has(x)) : arr;
  const pool = fresh.length ? fresh : arr;
  const v = pool[Math.floor(Math.random() * pool.length)];
  mem?.usedLines.add(v);
  return v;
}

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const ensurePeriod = (s) => (/[.!?]["']?$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

function framePrefix(persona, mem) {
  if (Math.random() < 0.45) return '';
  return `${pickLine(persona.lines.frames, mem).trim().replace(/[,:]?$/, ':')} `;
}

export function prosOf(opt) {
  if (opt?.pro?.length) return opt.pro;
  const l = opt?.label || 'this plan';
  return [
    `${ensurePeriod(opt?.desc || l)} That is the path I can defend.`,
    `${l} is the only option that faces this honestly.`,
    `Whatever it costs, ${l.toLowerCase()} is the choice I can live with.`,
  ];
}

export function consOf(opt) {
  if (opt?.con?.length) return opt.con;
  const l = opt?.label || 'that plan';
  return [
    `${l} sounds brave until you count what it costs.`,
    `I can't support ${l.toLowerCase()}; the price is too high.`,
    `${l} just trades one disaster for another.`,
  ];
}

const BASE_EMOTION = {
  vance: ['resolute', 'resolute', 'calm'],
  okafor: ['calm', 'anxious', 'resolute'],
  rivet: ['wry', 'resolute', 'anxious'],
  celeste: ['calm', 'wry', 'calm'],
  novak: ['calm', 'grieved', 'hopeful'],
  kestrel: ['defiant', 'angry', 'wry'],
  chen: ['calm', 'resolute', 'anxious'],
};

function chooseEmotion(agent, { crisis, agree, hostile, tension }) {
  const base = BASE_EMOTION[agent.id] || ['calm'];
  if (crisis) return Math.random() < 0.5 ? 'anxious' : (agent.persona.assertiveness > 0.7 ? 'resolute' : 'grieved');
  if (hostile && Math.random() < 0.6) return agent.persona.assertiveness > 0.7 ? 'angry' : 'defiant';
  if (agree && Math.random() < 0.5) return 'hopeful';
  if (tension > 70 && Math.random() < 0.4) return 'anxious';
  return base[Math.floor(Math.random() * base.length)];
}

/** Rough keyword overlap, used to infer which option a free-text idea supports. */
export function keywords(text) {
  return new Set((text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)
    .filter((w) => w.length > 3 && !STOP.has(w)));
}
const STOP = new Set(['this', 'that', 'with', 'from', 'have', 'there', 'their', 'they', 'would', 'could', 'should', 'about', 'which', 'every', 'everyone', 'station', 'council', 'what', 'when', 'will', 'into', 'than', 'then', 'them', 'were', 'been', 'only', 'more', 'some', 'over', 'your', 'ours', 'just', 'like', 'also', 'make', 'even']);

export function overlap(a, b) {
  const kb = keywords(b);
  let n = 0;
  for (const w of keywords(a)) if (kb.has(w)) n++;
  return n;
}

export function inferFavors(text, scenario) {
  let best = null;
  let score = 0;
  for (const o of scenario.options) {
    const s = overlap(text, `${o.label} ${o.label} ${o.desc}`);
    if (s > score) { score = s; best = o.id; }
  }
  return score >= 2 ? best : null;
}

export function offlineTurn(agent, council, moment) {
  const p = agent.persona;
  const mem = agent.memory;
  const sc = council.scenario;
  const last = council.lastSpeech();
  const lastAgent = last && last.speakerId !== agent.id ? council.agents.get(last.speakerId) : null;
  let pos = mem.stance.position;
  let conv = mem.stance.conviction;
  if (!sc.options.some((o) => o.id === pos)) { pos = sc.options[Math.floor(Math.random() * sc.options.length)].id; conv = 45; }
  let switched = false;

  // Persuasion: a trusted, confident speaker can pull a wavering listener over.
  // Traits scale openness to opposing views and willingness to change mind.
  const tr = agent.persona.traits || { openness: 0.5, persuadability: 0.5, assertiveness: 0.6, compromise: 0.5 };
  if (lastAgent && last.position && last.position !== pos && moment.kind === 'react') {
    const t = mem.trust[lastAgent.id] ?? 0;
    const opennessFactor = 0.4 + tr.openness * 1.2;
    const basePull = ((t / 100) * 0.5 + (last.conviction ?? 50) / 250 - (conv / 140) * (1.5 - tr.openness)) * opennessFactor;
    const pull = Math.max(0, basePull) * (0.3 + tr.persuadability * 1.4);
    if (Math.random() < pull) { pos = last.position; conv = 45 + Math.random() * 20; switched = true; }
    else conv += t < 0 ? Math.round(4 * (1.4 - tr.openness)) : -2;
  }
  // Crisis: alerts that undercut an option erode conviction in it; collapse means switching.
  if (moment.kind === 'crisis' && moment.shift) {
    conv += (moment.shift[pos] ?? 0) * (0.6 + tr.openness * 0.4);
    if (conv < 30) {
      const best = Object.entries(moment.shift).sort((x, y) => y[1] - x[1])[0];
      if (best && best[1] > 0 && best[0] !== pos && (Math.random() < tr.persuadability * 1.5)) {
        pos = best[0]; conv = 55; switched = true;
      }
    }
  }
  // Implanted whisper: the agent adopts it as their own idea.
  const w = mem.activeWhisper(council.turn);
  const freshWhisper = w && !w.used ? w : null;
  if (freshWhisper?.favors) {
    if (freshWhisper.favors !== pos) { pos = freshWhisper.favors; conv = Math.max(conv, 68); switched = true; }
    else conv += 10;
  }

  // Carrier dispatch: public intel influences stance and conviction.
  if (moment.kind === 'carrier') {
    if (moment.favors && moment.favors !== pos) {
      const shiftChance = (0.3 + (moment.impact ?? 1) * 0.15 + (tr.openness - 0.5) * 0.25) * (0.4 + tr.persuadability * 1.2);
      if (Math.random() < shiftChance) { pos = moment.favors; conv = 50 + Math.random() * 20; switched = true; }
      else conv = clamp(conv - Math.round(15 * tr.openness), 10, 95);
    } else if (moment.favors === pos) {
      conv = clamp(conv + 15, 10, 98);
    }
  }
  conv = clamp(Math.round(conv), 5, 98);

  const opt = sc.options.find((o) => o.id === pos);
  const lastOpt = last?.position ? sc.options.find((o) => o.id === last.position) : null;
  const trustLast = lastAgent ? mem.trust[lastAgent.id] ?? 0 : 0;
  const agree = !!lastAgent && (last.position === pos || trustLast > 50);

  // Address selection: prevent ping-pong loops in council mode, or address rival / audience in debate mode.
  let targetAgent = lastAgent;
  let addressingName = 'Council';
  if (moment.kind === 'chair') {
    addressingName = 'Chair';
  } else if (council.mode === 'debate' && council.debaters?.includes(agent.id)) {
    const rivalId = council.debaters.find((id) => id !== agent.id);
    const rivalAgent = council.agents.get(rivalId);
    if (Math.random() < 0.65 && rivalAgent) {
      targetAgent = rivalAgent;
      addressingName = rivalAgent.persona.short;
    } else {
      addressingName = 'Council';
      targetAgent = null;
    }
  } else {
    const roll = Math.random();
    if (roll < 0.35 && lastAgent) {
      targetAgent = lastAgent;
      addressingName = lastAgent.persona.short;
    } else if (roll < 0.70) {
      // Pick another council member who is quiet or whose stance opposes
      const candidates = council.agentList.filter((x) => x.id !== agent.id && (!lastAgent || x.id !== lastAgent.id));
      if (candidates.length) {
        candidates.sort((x, y) => (y.lastSpokeTurn == null ? 99 : council.turn - y.lastSpokeTurn) - (x.lastSpokeTurn == null ? 99 : council.turn - x.lastSpokeTurn));
        targetAgent = candidates[0];
        addressingName = targetAgent.persona.short;
      }
    } else if (roll < 0.88) {
      addressingName = 'Council';
      targetAgent = null;
    } else {
      addressingName = 'Chair';
      targetAgent = null;
    }
  }

  const parts = [];

  // Beat 1: reaction.
  if (moment.kind === 'chair') {
    parts.push(pickLine(p.lines.chair, mem));
  } else if (moment.kind === 'crisis') {
    parts.push(pickLine(p.lines.crisis, mem));
  } else if (moment.kind === 'carrier') {
    parts.push(pickLine([
      `The carrier dispatch confirms what I feared.`,
      `Telemetry from that carrier changes the equation.`,
      `Look at the carrier report that just arrived:`,
      `We have new station data on the table.`,
    ], mem));
  } else if (moment.kind === 'open' || !lastAgent) {
    parts.push(pickLine(p.lines.open, mem));
  } else if (targetAgent && targetAgent !== lastAgent) {
    const targetAgree = targetAgent.memory.stance.position === pos;
    parts.push(fill(pickLine(targetAgree ? p.lines.agree : p.lines.disagree, mem), { name: targetAgent.persona.short }));
  } else {
    parts.push(fill(pickLine(agree ? p.lines.agree : p.lines.disagree, mem), { name: lastAgent.persona.short }));
  }

  // Beat 2: substance.
  let usedWhisper = false;
  if (freshWhisper) {
    parts.push(`${pickLine(p.lines.whisper, mem)} ${ensurePeriod(freshWhisper.text)}`);
    usedWhisper = true;
  } else if (moment.kind === 'crisis') {
    const d = moment.shift?.[pos] ?? 0;
    const lead = switched ? 'That settles it for me.' : d < 0 ? pickLine(HURT_LINES) : d > 0 ? pickLine(HELP_LINES) : '';
    parts.push(`${lead ? `${lead} ` : ''}${pickLine(prosOf(opt), mem)}`);
  } else if (moment.kind === 'carrier') {
    parts.push(`${switched ? 'That settles it. ' : ''}${pickLine(prosOf(opt), mem)}`);
  } else if (switched) {
    parts.push(`${pickLine(SHIFT_LINES)} ${pickLine(prosOf(opt), mem)}`);
  } else if (moment.kind === 'chair' && /\b(stand|position|support|favou?r|where are you|vote)\b/i.test(moment.text || '')) {
    parts.push(`I stand for ${opt.label}. ${pickLine(prosOf(opt), mem)}`);
  } else if (!agree && lastOpt && lastOpt.id !== pos && Math.random() < 0.5) {
    parts.push(pickLine(consOf(lastOpt), mem));
  } else {
    parts.push(`${framePrefix(p, mem)}${pickLine(prosOf(opt), mem)}`);
  }

  // Beat 3: signature closer.
  if (Math.random() < 0.5) parts.push(pickLine(p.lines.closer, mem));

  // Determine rhetoric appeal for Debate Mode
  const pBias = p.rhetoricBias || { logos: 1, pathos: 1, ethos: 1, pragmatism: 1 };
  const rhetoricRoll = Math.random() * (pBias.logos + pBias.pathos + pBias.ethos + pBias.pragmatism);
  let rhetoric = 'logos';
  if (rhetoricRoll < pBias.logos) rhetoric = 'logos';
  else if (rhetoricRoll < pBias.logos + pBias.pathos) rhetoric = 'pathos';
  else if (rhetoricRoll < pBias.logos + pBias.pathos + pBias.ethos) rhetoric = 'ethos';
  else rhetoric = 'pragmatism';

  // Private channel: inner monologue that may contradict the public line.
  const rival = council.agentList.filter((a) => a.id !== agent.id)
    .sort((a, b) => (mem.trust[a.id] ?? 0) - (mem.trust[b.id] ?? 0))[0];
  let thought;
  if (usedWhisper && Math.random() < 0.6) thought = pickLine(['I can\'t say how I know. But I know.', 'Where did that idea come from? It feels like it was always mine.', 'If they knew where this came from, they wouldn\'t believe it.']);
  else thought = fill(pickLine(p.inner, mem), { name: (targetAgent || lastAgent || rival)?.persona.short || 'someone', option: opt.label });

  const trust_shift = [];
  if (targetAgent) {
    const d = agree ? 3 + Math.round(Math.random() * 3) : -(2 + Math.round(Math.random() * (trustLast < 0 ? 5 : 3)));
    trust_shift.push({ id: targetAgent.id, delta: d });
  }

  return {
    speech: parts.filter(Boolean).join(' '),
    inner_thought: thought,
    position: pos,
    conviction: conv,
    emotion: chooseEmotion(agent, { crisis: moment.kind === 'crisis', agree, hostile: !!lastAgent && !agree && trustLast < -20, tension: council.tension }),
    addressing: addressingName,
    trust_shift,
    used_whisper: usedWhisper,
    rhetoric,
  };
}

export function offlineBallot(agent, council, motion) {
  const p = agent.persona;
  const mem = agent.memory;
  const sc = council.scenario;
  const pos = mem.stance.position;
  const conv = mem.stance.conviction;
  let vote;
  if (motion.optionId) {
    if (pos === motion.optionId) vote = 'AYE';
    else if (conv < 35) vote = Math.random() < 0.6 ? 'ABSTAIN' : 'AYE';
    else vote = 'NAY';
  } else {
    const own = sc.options.find((o) => o.id === pos);
    const fit = overlap(motion.text, `${own?.label || ''} ${own?.desc || ''}`);
    vote = fit >= 1 ? 'AYE' : Math.random() < 0.3 ? 'ABSTAIN' : 'NAY';
  }
  const motionOpt = motion.optionId ? sc.options.find((o) => o.id === motion.optionId) : null;
  const line = pickLine(vote === 'AYE' ? p.lines.ballotAye : vote === 'NAY' ? p.lines.ballotNay : p.lines.ballotAbstain, mem);
  const shared = motion.usedLines || (motion.usedLines = new Set());
  const pool = motionOpt ? (vote === 'AYE' ? prosOf(motionOpt) : consOf(motionOpt)).filter((l) => !shared.has(l)) : [];
  const extraLine = vote !== 'ABSTAIN' && pool.length && Math.random() < 0.6 ? pickLine(pool, mem) : '';
  if (extraLine) shared.add(extraLine);
  const extra = extraLine ? ` ${extraLine}` : '';
  const thought = vote === 'AYE'
    ? pickLine(['Let it be done, and let me be right.', 'There. My name is on it now.', 'I hope I can live with this.'])
    : vote === 'NAY'
      ? pickLine(['If it passes anyway, I\'ll be ready.', 'Someone in this room has to say no.', 'History will want to know who objected.'])
      : pickLine(['Cowardice or wisdom? Ask me in a year.', 'I can\'t carry this one.']);
  return { vote, rationale: `${line}${extra}`, inner_thought: thought };
}

export function offlineEpilogue(council, motion, tally) {
  const sc = council.scenario;
  if (!tally.passed) return { headline: sc.outcomes?.failed?.headline || 'The Motion Fails', epilogue: sc.outcomes?.failed?.text || 'The council could not agree, and the crisis did not wait.' };
  if (motion.optionId && sc.outcomes?.[motion.optionId]) {
    const o = sc.outcomes[motion.optionId];
    return { headline: o.headline, epilogue: o.text };
  }
  return {
    headline: 'The Motion Carries',
    epilogue: sc.year
      ? `By ${tally.aye} votes to ${tally.nay}, the meeting resolved: "${motion.text}" It was carried out before morning, and everyone in that room lived with the consequences for the rest of their lives.`
      : `By ${tally.aye} votes to ${tally.nay}, the council resolved: "${motion.text}" The station moved to carry it out within the hour, and the people of Halcyon lived with the consequences, as they always had.`,
  };
}
