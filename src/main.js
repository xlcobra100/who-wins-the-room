/**
 * Halcyon Council — game controller.
 *
 * Wires the DOM-free council engine (src/engine) to the 3D stage (src/scene),
 * the HUD (src/ui) and audio (src/audio). The council decides *what* happens;
 * this file decides how it is performed (camera, subtitles, voices, sound) and
 * turns player input into the four levers: gavel, crisis, whisper, vote.
 */
import './style.css';
import { PERSONAS, personaById, castFor, eraOf } from './data/personas.js';
import { SCENARIOS, scenarioById, OPTION_COLORS } from './data/scenarios.js';
import { Council } from './engine/council.js';
import { LLMClient, fetchHealth } from './engine/llm.js';
import { designScenario } from './engine/designer.js';
import { inferFavors } from './engine/offline.js';
import { Stage } from './scene/stage.js';
import { Hud, esc } from './ui/hud.js';
import { Sfx } from './audio/sfx.js';
import { Voices } from './audio/voice.js';

// ------------------------------------------------------------------ settings
const SETTINGS_KEY = 'halcyon.settings.v1';
const KEY_KEY = 'halcyon.claudeKey';
const DEFAULTS = {
  engine: 'ollama', ollamaModel: '', claudeModel: 'claude-opus-5-5',
  voices: true, minds: true, sound: true, volume: 0.6, quality: 'high', pace: 1, camera: 'focus', web: false,
};
function loadSettings() {
  let s = { ...DEFAULTS };
  try { s = { ...s, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { /* private mode */ }
  try { s.apiKey = sessionStorage.getItem(KEY_KEY) || ''; } catch { s.apiKey = ''; }
  return s;
}
function saveSettings() {
  const { apiKey, ...rest } = settings;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(rest)); } catch { /* ignore */ }
  try { if (apiKey) sessionStorage.setItem(KEY_KEY, apiKey); else sessionStorage.removeItem(KEY_KEY); } catch { /* ignore */ }
}
const settings = loadSettings();

// ------------------------------------------------------------------ singletons
const sfx = new Sfx();
sfx.setEnabled(settings.sound);
sfx.setVolume(settings.volume);
const voices = new Voices();
voices.setPersonas(PERSONAS);
const stage = new Stage(document.getElementById('stage'));
stage.setCast(PERSONAS);
stage.setQuality(settings.quality);
const llm = new LLMClient(settings);
let council = null;
let health = { ollama: { ok: false, models: [] }, claude: { models: [] } };
let interruptResolve = null;
let currentBallots = [];
let firstThinkPending = true;
let webTimer = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const optColor = (id) => OPTION_COLORS[id] || OPTION_COLORS.undecided;
// The persona as seated in the current session (1900s scenarios use period identities).
const castOf = (id) => council?.agents.get(id)?.persona || personaById(id);
document.body.classList.add('at-start');
document.body.classList.toggle('hide-minds', !settings.minds);

const hud = new Hud({
  onConvene: convene,
  onPlay: () => { if (!council) return; sfx.click(); council.auto ? council.pause() : council.play(); },
  onStep: () => { if (!council) return; sfx.click(); council.pause(); council.step(); },
  onPace: (v) => { settings.pace = v; council?.setSpeed(v); saveSettings(); },
  onCamera: (m) => { stage.cam.setMode(m); settings.camera = m; saveSettings(); },
  onToggleMinds: () => setMinds(!settings.minds),
  onToggleWeb: () => setWeb(!settings.web),
  onToggleVoice: () => setVoices(!settings.voices),
  onSettings: openSettings,
  onHome: confirmLeave,
  onLever: openLever,
  onSelect: select,
  onInspect: (id) => { select(id); const ch = stage.char(id); if (ch) stage.cam.inspect(ch); },
  onTraitChange: (agentId, traitKey, val) => {
    if (council) council.updateAgentTrait(agentId, traitKey, val);
    const p = personaById(agentId);
    if (p && p.traits) p.traits[traitKey] = val;
  },
  onThemeChange: (theme) => {
    settings.theme = theme;
    stage.setTheme(theme);
    saveSettings();
  },
  onThemeToggle: () => {
    const next = stage.currentTheme === 'boardroom1900' ? 'scifi' : 'boardroom1900';
    settings.theme = next;
    stage.setTheme(next);
    hud.toast(`Chamber set to ${next === 'boardroom1900' ? '1900s Grand Boardroom' : 'Halcyon Orbital Chamber'}`);
    saveSettings();
  },
});
stage.onSelect = (id) => { if (council) select(id); };
stage.onInspect = (id) => { if (council) { select(id); stage.cam.inspect(stage.char(id)); } };
stage.cam.onMode((m) => hud.setCameraMode(m));
hud.setCameraMode('overview');
stage.cam.goOverview(4);
hud.setToggle('#btnMinds', settings.minds);
hud.setToggle('#btnVoice', settings.voices);
hud.setToggle('#btnWeb', settings.web);
document.getElementById('pace').value = settings.pace;

// ------------------------------------------------------------------ boot
async function refreshHealth() {
  health = await fetchHealth();
  const o = health.ollama;
  if (o.ok && (!settings.ollamaModel || !o.models.some((m) => m.name === settings.ollamaModel))) settings.ollamaModel = o.recommended || '';
  if (settings.engine === 'ollama' && !(o.ok && o.models.length)) settings.engine = 'offline';
  hud.renderStart({ scenarios: SCENARIOS, personas: PERSONAS, health, settings });
  if (health.apiDown) hud.toast('The local API server is not running, so only the offline engine is available. Start the game with `npm run dev`.', 'warn', 9000);
}
refreshHealth();

// ------------------------------------------------------------------ session
async function convene({ mode = 'council', debaters = null, scenarioId, customText, voices: v, minds, theme = null }) {
  sfx.ensure();
  setVoices(v, true);
  setMinds(minds, true);
  saveSettings();
  if (settings.engine === 'ollama' && !settings.ollamaModel) settings.engine = 'offline';
  let scenario;
  if (customText) {
    hud.loading(llm.online ? `The council's designer is drafting your dilemma… (${settings.engine === 'ollama' ? 'about 30–60 s on a local model' : 'a few seconds'})` : 'Preparing your dilemma…');
    const r = await designScenario(customText, PERSONAS, llm.online ? llm : null);
    hud.loading(null);
    scenario = r.scenario;
    if (llm.online && !r.designed) hud.toast(`The designer could not adapt your dilemma (${r.error || 'unknown error'}), so a generic structure is used.`, 'warn', 8000);
  } else {
    scenario = structuredClone(scenarioById(scenarioId));
  }
  startSession(scenario, mode, debaters, theme);
}

function startSession(scenario, mode = 'council', debaters = null, theme = null) {
  council?.destroy();
  voices.cancel();
  firstThinkPending = true;
  const cast = castFor(eraOf(scenario));
  council = new Council({ scenario, personas: cast, llm, speed: settings.pace, mode, debaters });
  wireCouncil(council);
  const activeTheme = theme || scenario.theme || settings.theme || 'scifi';
  stage.setTheme(activeTheme);
  stage.clearBallots();
  stage.clearSpeaker();
  stage.setGlyph(scenario.glyph);
  stage.setSelected(null);
  stage.setCast(cast, mode, debaters);
  hud.beginSession(council);
  hud.setEngine(settings);
  hud.setLeversEnabled(true);
  hud.hideStart();
  document.body.classList.remove('at-start');
  syncAll();
  stage.setWebVisible(settings.web);
  stage.cam.setMode('overview');
  stage.cam.goOverview(2.2);
  hud.setAuto(false);
  council.start();
  setTimeout(() => {
    if (!council || council.scenario !== scenario) return;
    if (settings.camera !== 'overview') stage.cam.setMode(settings.camera);
    council.play();
  }, 2300);
}

function wireCouncil(c) {
  c.playback = (entry) => playEntry(entry);
  c.interruptPlayback = () => { voices.cancel(); interruptResolve?.(); };
  c.on('entry', (e) => {
    hud.addEntry(e, c);
    if (e.kind === 'ballot') currentBallots.push(e);
  });
  c.on('thinking', ({ agentId }) => {
    stage.setThinking(agentId, true);
    hud.setEngine(settings, llm.online);
    if (stage.cam.mode === 'focus' && !stage.speakerId) stage.cam.focusSpeaker(stage.char(agentId), null, { kind: 'inner', duration: 1.8 });
    if (firstThinkPending && llm.online) {
      firstThinkPending = false;
      setTimeout(() => {
        if (c.agents.get(agentId)?.status === 'thinking' && c === council) {
          hud.toast(settings.engine === 'ollama' ? `Loading ${settings.ollamaModel} into GPU memory. The first turn takes a few extra seconds.` : 'Waiting for the first reply from Claude…', 'info', 6000);
        }
      }, 3500);
    }
  });
  c.on('idle', ({ agentId }) => { stage.setThinking(agentId, false); hud.setEngine(settings, false); });
  c.on('speech', (e) => { stage.setThinking(e.speakerId, false); hud.setEngine(settings, false); });
  c.on('state', () => syncAll());
  c.on('auto', (on) => hud.setAuto(on));
  c.on('chair', (e) => {
    stage.chairSpeaks();
    sfx.gavel();
    hud.showSubtitle({ text: e.text, kind: 'chair' }, null, { chair: true });
    hud.hideSubtitle(false, 4500);
  });
  c.on('crisis', (e) => { stage.crisis(); sfx.alarm(); hud.alert(e.title, e.text); });
  c.on('carrier', (e) => {
    stage.deployCarrier(e);
    sfx.carrier();
    hud.alert('🛰️ CARRIER DISPATCH', `${e.title}: ${e.text}`);
  });
  c.on('sway', ({ entry, sways }) => {
    sfx.sway();
    const flipped = sways.filter((s) => s.flipped);
    if (flipped.length) {
      hud.toast(`${flipped.map((s) => s.name).join(', ')} flipped stance to [${flipped[0].newPos}]!`, 'info', 4000);
    }
  });
  c.on('whisper', (e) => {
    stage.whisper(e.speakerId);
    sfx.whisper();
    const p = castOf(e.speakerId);
    hud.toast(`Idea seeded in ${p.short}'s mind. ${p.pronouns.startsWith('they') ? 'They' : p.pronouns.startsWith('she') ? 'She' : 'He'} will believe it is ${p.pronouns.startsWith('they') ? 'their' : p.pronouns.startsWith('she') ? 'her' : 'his'} own.`, 'info');
  });
  c.on('voteStart', ({ motion }) => {
    currentBallots = [];
    stage.voteStart();
    hud.closePopover();
    hud.showVotePanel(c, motion);
    hud.setLeversEnabled(false);
  });
  c.on('ballotReady', ({ agentId }) => hud.voteSlot(agentId, 'ready'));
  c.on('tallying', () => hud.voteStatus('The Chronicle is recording the outcome…'));
  c.on('voteResult', (e) => showVoteResult(e));
  c.on('notice', (n) => hud.toast(n.text, n.level));
  c.on('engine', () => { hud.setEngine(settings); saveSettings(); });
}

/** Perform one entry: camera, gaze, subtitles, voice. Resolves when done or interrupted. */
async function playEntry(entry) {
  const persona = castOf(entry.speakerId);
  const pace = settings.pace;
  const interrupted = new Promise((res) => { interruptResolve = () => res('cut'); });
  sfx.blip();
  if (entry.kind === 'ballot') {
    stage.setSpeaker(entry.speakerId, 'chair', { kind: 'inner' });
    stage.showBallot(entry.speakerId, entry.vote);
    sfx.ballot(entry.vote);
    hud.voteSlot(entry.speakerId, 'cast', entry.vote);
  } else {
    stage.setSpeaker(entry.speakerId, entry.addressingId);
  }
  const sub = hud.showSubtitle(entry, persona, { minds: settings.minds });
  const words = entry.text.split(/\s+/).length;
  const est = Math.max(2200, (words * 330 + 700) / pace);
  const speaking = settings.voices && voices.supported ? voices.speak(entry.text, persona, pace, (i) => sub.boundary(i)) : null;
  sub.start(speaking ? est * 1.1 : est);
  const done = speaking
    ? speaking.then((ok) => sleep(ok ? 300 : Math.max(0, est - 200)))
    : sleep(est + 450 / pace);
  const r = await Promise.race([done.then(() => 'done'), interrupted]);
  interruptResolve = null;
  if (r === 'cut') {
    sub.cut();
    voices.cancel();
    await sleep(350);
  } else {
    sub.finish();
    if (settings.minds && entry.thought) await sleep(Math.min(1700, 1000 / pace));
  }
  stage.clearSpeaker();
  hud.hideSubtitle(false, 6000);
}

function syncAgent(a) {
  const ch = stage.char(a.id);
  if (!ch) return;
  stage.setStance(a.id, a.memory.stance.position, optColor(a.memory.stance.position), a.memory.stance.conviction);
  ch.setEmotion(a.emotion);
  ch.setWhispers(a.memory.whispers.length, a.memory.hasUnusedWhisper());
}

function syncAll() {
  if (!council) return;
  for (const a of council.agentList) syncAgent(a);
  hud.updateMeters(council);
  hud.renderBrief(council);
  stage.setTension(council.tension);
  sfx.setTension(council.tension);
  if (hud.selected) hud.renderInspector(council);
  if (settings.web) {
    clearTimeout(webTimer);
    webTimer = setTimeout(() => stage.rebuildWeb((a, b) => council.agents.get(a).memory.trust[b] ?? 0), 200);
  }
}

function select(id) {
  if (!council) return;
  stage.setSelected(id);
  hud.renderInspector(council, id);
}

// ------------------------------------------------------------------ toggles
function setMinds(on, quiet = false) {
  settings.minds = on;
  document.body.classList.toggle('hide-minds', !on);
  hud.setToggle('#btnMinds', on);
  if (!quiet) { saveSettings(); hud.toast(on ? 'Private thoughts revealed.' : 'Private thoughts hidden. Only the inspector shows them now.'); }
}

function setVoices(on, quiet = false) {
  settings.voices = on && voices.supported;
  voices.enabled = settings.voices;
  if (!settings.voices) voices.cancel();
  hud.setToggle('#btnVoice', settings.voices);
  if (!quiet) { saveSettings(); if (on && !voices.supported) hud.toast('This browser has no speech synthesis.', 'warn'); }
}

function setWeb(on) {
  settings.web = on;
  hud.setToggle('#btnWeb', on);
  stage.setWebVisible(on);
  if (on && council) stage.rebuildWeb((a, b) => council.agents.get(a).memory.trust[b] ?? 0);
  saveSettings();
}

// ------------------------------------------------------------------ levers
function openLever(name, opts = {}) {
  if (!council) return;
  if (council.phase !== 'debate') { hud.toast('The council is voting. Wait for the result.', 'warn'); return; }
  if (hud.openLever === name && !opts.target) { hud.closePopover(); return; }
  sfx.click();
  hud.markLever(name);
  ({ gavel: openGavel, carrier: openCarrier, crisis: openCrisis, whisper: openWhisper, vote: openVote })[name]?.(opts);
}

function popButtons(sendLabel, cls) {
  return `<span class="spacer"></span><button class="btn ghost" data-act="cancel">Cancel</button><button class="btn ${cls}" data-act="send">${sendLabel}</button>`;
}

function bindPopover(pop, submit) {
  pop.querySelector('[data-act=cancel]').onclick = () => hud.closePopover();
  pop.querySelector('[data-act=send]').onclick = submit;
  pop.querySelectorAll('textarea').forEach((t) => t.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  }));
}

function openGavel({ target } = {}) {
  const quick = [
    'Order! Order in the chamber.',
    'Each of you: where do you stand, in one sentence?',
    'What is the strongest argument against your own position?',
    'Someone at this table is holding something back. Who?',
    'We need a compromise. Propose one.',
  ];
  const t = target ? council.agents.get(target).persona : null;
  hud.openPopover(`
    <div class="pop-title" style="color:var(--amber)">THE GAVEL</div>
    <div class="pop-sub">Speak as the Chair. Name a member to put the question to them, or address everyone ("each of you…"). The current speaker is cut off.</div>
    <div class="quick">${quick.map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <textarea id="gavelText" rows="2" placeholder="${t ? `${esc(t.title)} ${esc(t.short)}, ` : 'Order. '}what exactly are you asking Ring C to give up?">${t ? `${esc(t.title)} ${esc(t.short)}, ` : ''}</textarea>
    <div class="pop-row stack">
      <select class="sel" id="gavelTarget"><option value="">Answered by: whoever you name (or the best responder)</option>
        ${council.agentList.map((a) => `<option value="${a.id}" ${a.id === target ? 'selected' : ''}>Answered by: ${esc(a.persona.name)}</option>`).join('')}</select>
    </div>
    <div class="pop-row">${popButtons('Strike the gavel', 'amber')}
    </div>`, (pop) => {
    pop.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => { pop.querySelector('#gavelText').value = b.dataset.q; pop.querySelector('#gavelText').focus(); }));
    const ta = pop.querySelector('#gavelText');
    ta.setSelectionRange(ta.value.length, ta.value.length);
    bindPopover(pop, () => {
      const text = ta.value.trim() || 'Order. Order in the chamber.';
      const tgt = pop.querySelector('#gavelTarget').value || null;
      hud.closePopover();
      council.gavel(text, tgt);
    });
  });
}

function openCarrier() {
  const sc = council.scenario;
  const presets = sc.carrierPresets || [
    { title: 'Telemetry Update', text: 'Telemetry monitors show active fluctuations across life support sectors.', favors: sc.options[0]?.id },
    { title: 'Sub-Deck Notice', text: 'Cargo handlers reporting unauthorized movement near loading bays.', favors: sc.options[1]?.id },
  ];
  let chosen = null;
  hud.openPopover(`
    <div class="pop-title" style="color:#5fe1ff">CARRIER DISPATCH</div>
    <div class="pop-sub">Deploy a high-speed orbital carrier drone into the chamber. The intelligence is broadcast in the center of the room for EVERY member to see and react to simultaneously.</div>
    <div class="presets">${presets.map((p, i) => `<button class="preset" data-i="${i}"><b>${p.favors ? `Supports [${esc(p.favors)}] · ` : ''}${esc(p.title)}</b><span>${esc(p.text)}</span></button>`).join('')}</div>
    <input class="field" id="carrierTitle" type="text" placeholder="Dispatch Headline (e.g. Scrubber Core Telemetry)" />
    <div style="height:8px"></div>
    <textarea id="carrierText" rows="2" placeholder="Public information to broadcast across the chamber..."></textarea>
    <div class="pop-row stack" style="margin-top:8px">
      <select class="sel" id="carrierFavors">
        <option value="">Favors: Neutral / Inferred</option>
        ${sc.options.map((o) => `<option value="${o.id}">Favors Option ${o.id}: ${esc(o.label)}</option>`).join('')}
      </select>
    </div>
    <div class="pop-row">${popButtons('Launch Carrier Drone', 'primary')}</div>`, (pop) => {
    const title = pop.querySelector('#carrierTitle');
    const text = pop.querySelector('#carrierText');
    const favorsSel = pop.querySelector('#carrierFavors');

    pop.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      chosen = presets[+b.dataset.i];
      pop.querySelectorAll('.preset').forEach((x) => x.classList.toggle('is-selected', x === b));
      title.value = chosen.title;
      text.value = chosen.text;
      if (chosen.favors) favorsSel.value = chosen.favors;
    }));

    bindPopover(pop, () => {
      const t = title.value.trim() || 'Station Dispatch';
      const d = text.value.trim();
      if (!d && !title.value.trim()) { text.focus(); return; }
      const fav = favorsSel.value || (chosen && chosen.text === d ? chosen.favors : inferFavors(d || t, sc));
      hud.closePopover();
      council.carrierDispatch({ title: t, text: d || t, favors: fav, severity: 2 });
    });
  });
}

function openCrisis() {
  const sc = council.scenario;
  const fired = new Set(council.transcript.filter((e) => e.kind === 'crisis').map((e) => e.title));
  let chosen = null;
  let severity = 2;
  hud.openPopover(`
    <div class="pop-title" style="color:var(--red)">CRISIS SHOCK</div>
    <div class="pop-sub">Drop a new emergency into the room. Everyone hears it at once, and the members it hurts most react first.</div>
    <div class="presets">${sc.crises.map((c, i) => `<button class="preset" data-i="${i}"><span class="sev">${'▲'.repeat(c.severity)}${fired.has(c.title) ? ' · fired' : ''}</span><b>${esc(c.title)}</b><span>${esc(c.text)}</span></button>`).join('')}</div>
    <input class="field" id="crisisTitle" type="text" placeholder="Custom alert headline" />
    <div style="height:8px"></div>
    <textarea id="crisisText" rows="2" placeholder="What just happened?"></textarea>
    <div class="pop-row"><div class="sev-pick">Severity ${[1, 2, 3].map((n) => `<button data-sev="${n}" class="${n === 2 ? 'is-selected' : ''}">${n}</button>`).join('')}</div>${popButtons('Sound the alarm', 'danger')}</div>`, (pop) => {
    const title = pop.querySelector('#crisisTitle');
    const text = pop.querySelector('#crisisText');
    const setSev = (n) => { severity = n; pop.querySelectorAll('[data-sev]').forEach((b) => b.classList.toggle('is-selected', +b.dataset.sev === n)); };
    pop.querySelectorAll('[data-sev]').forEach((b) => b.addEventListener('click', () => setSev(+b.dataset.sev)));
    pop.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      chosen = sc.crises[+b.dataset.i];
      pop.querySelectorAll('.preset').forEach((x) => x.classList.toggle('is-selected', x === b));
      title.value = chosen.title;
      text.value = chosen.text;
      setSev(chosen.severity);
    }));
    bindPopover(pop, () => {
      const t = title.value.trim();
      const d = text.value.trim();
      if (!t && !d) { title.focus(); return; }
      const isPreset = chosen && chosen.title === t && chosen.text === d;
      hud.closePopover();
      council.crisis({ title: t || 'Emergency', text: d || t, severity, shift: isPreset ? chosen.shift : {} });
    });
  });
}

function openWhisper({ target } = {}) {
  const sc = council.scenario;
  let who = target || null;
  let preset = null;
  hud.openPopover(`
    <div class="pop-title" style="color:var(--violet)">CONFIDENTIAL WHISPER</div>
    <div class="pop-sub">Implant an idea or a piece of secret intel in one mind. They will experience it as their own thought and champion it at the table. No one else will know it came from you.</div>
    <div class="targets">${council.agentList.map((a) => `<button class="target${a.id === who ? ' is-selected' : ''}" data-id="${a.id}" style="--c:${a.persona.color}"><i></i>${esc(a.persona.short)}<small>${esc(a.memory.stance.position)}</small></button>`).join('')}</div>
    <div class="presets">${sc.whispers.map((w, i) => `<button class="preset" data-i="${i}"><b>${w.favors ? `Supports ${esc(w.favors)} · ${esc(sc.options.find((o) => o.id === w.favors)?.label || '')}` : 'Intel'}</b><span>${esc(w.text)}</span></button>`).join('')}</div>
    <textarea id="whisperText" rows="2" placeholder="e.g. The relief tug's captain owes you a favour and could burn three days early."></textarea>
    <div class="pop-row">${popButtons('Implant the idea', 'violet')}</div>`, (pop) => {
    const ta = pop.querySelector('#whisperText');
    pop.querySelectorAll('.target').forEach((b) => b.addEventListener('click', () => {
      who = b.dataset.id;
      pop.querySelectorAll('.target').forEach((x) => x.classList.toggle('is-selected', x === b));
    }));
    pop.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      preset = sc.whispers[+b.dataset.i];
      pop.querySelectorAll('.preset').forEach((x) => x.classList.toggle('is-selected', x === b));
      ta.value = preset.text;
    }));
    bindPopover(pop, () => {
      const text = ta.value.trim();
      if (!who) { hud.toast('Choose whose mind to whisper into.', 'warn'); return; }
      if (!text) { ta.focus(); return; }
      const favors = preset && preset.text === text ? preset.favors : inferFavors(text, sc);
      hud.closePopover();
      council.whisper(who, text, favors);
      select(who);
    });
  });
}

function openVote() {
  const sc = council.scenario;
  const cons = council.consensus();
  let chosen = null;
  hud.openPopover(`
    <div class="pop-title" style="color:var(--cyan)">CALL A BINDING VOTE</div>
    <div class="pop-sub">Put a motion to the council. Each member casts AYE, NAY or ABSTAIN with a spoken rationale. A simple majority of votes cast carries it.</div>
    <div class="presets">${sc.options.map((o) => `<button class="preset" data-id="${o.id}"><span class="sev" style="color:var(--muted)">${(cons[o.id] || []).map((id) => council.agents.get(id).persona.short).join(', ') || 'no support yet'}</span><b><span style="color:${optColor(o.id)}">${o.id}</span> · ${esc(o.label)}</b><span>${esc(o.desc)}</span></button>`).join('')}</div>
    <textarea id="voteText" rows="2" placeholder="Or write your own motion…"></textarea>
    <div class="pop-row">${popButtons('Call the vote', 'primary')}</div>`, (pop) => {
    const ta = pop.querySelector('#voteText');
    pop.querySelectorAll('.preset').forEach((b) => b.addEventListener('click', () => {
      chosen = sc.options.find((o) => o.id === b.dataset.id);
      pop.querySelectorAll('.preset').forEach((x) => x.classList.toggle('is-selected', x === b));
      ta.value = `${chosen.label}: ${chosen.desc}`;
    }));
    bindPopover(pop, () => {
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      const optionId = chosen && ta.value === `${chosen.label}: ${chosen.desc}` ? chosen.id : null;
      hud.closePopover();
      council.callVote({ text, optionId });
    });
  });
}

function showVoteResult(e) {
  sfx.verdict(e.tally.passed);
  hud.hideVotePanel();
  hud.setLeversEnabled(true);
  const c = council;
  const pass = e.tally.passed;
  hud.modal(`
    <h2>THE COUNCIL HAS VOTED</h2>
    <div class="verdict ${pass ? 'pass' : 'fail'}">${pass ? 'MOTION CARRIED' : 'MOTION FAILS'}</div>
    <div class="tally">${e.tally.aye} AYE · ${e.tally.nay} NAY · ${e.tally.abstain} ABSTAIN</div>
    <div class="motion-text">${esc(e.motion.text)}</div>
    <div class="ballot-list">${currentBallots.map((b) => {
      const p = castOf(b.speakerId);
      return `<div class="ballot-row" style="--c:${p.color}"><span class="nm">${esc(p.short)}</span><span><b class="ballot ballot-${b.vote.toLowerCase()}">${b.vote}</b></span>
        <span>${esc(b.text)}${settings.minds && b.thought ? `<span class="th">thinks: ${esc(b.thought)}</span>` : ''}</span></div>`;
    }).join('')}</div>
    <div class="chronicle"><div class="k">THE CHRONICLE DISPATCH</div><h3>${esc(e.epilogue.headline)}</h3><p>${esc(e.epilogue.epilogue)}</p></div>
    
    <div class="aftermath-box">
      <div class="af-kicker">CHAIR'S DIRECTIVE: HOW DID THIS DECISION PLAY OUT?</div>
      <div class="af-choices">
        <label class="af-choice is-selected">
          <input type="radio" name="aftermathOpt" value="total_failure" checked />
          <div>
            <b>💥 Total Failure (Catastrophic Collapse)</b>
            <p>Containment ruptured, auxiliary scrubbers seized, and riots erupted. Dissenters are furious and vindicated.</p>
          </div>
        </label>
        <label class="af-choice">
          <input type="radio" name="aftermathOpt" value="pyrrhic" />
          <div>
            <b>⚖️ Pyrrhic Compromise (Costly Survival)</b>
            <p>The motion held by the skin of its teeth, but at brutal collateral expense and severed alliances.</p>
          </div>
        </label>
        <label class="af-choice">
          <input type="radio" name="aftermathOpt" value="fragile_truce" />
          <div>
            <b>⏳ Fragile Order (Simmering Distrust)</b>
            <p>Immediate panic was arrested, but cover-up accusations simmer. An uneasy, fragile order.</p>
          </div>
        </label>
        <label class="af-choice">
          <input type="radio" name="aftermathOpt" value="breakthrough" />
          <div>
            <b>✨ Decisive Breakthrough (Clean Execution)</b>
            <p>The course of action succeeded beyond expectations, stabilizing the situation and silencing critics.</p>
          </div>
        </label>
      </div>
      <input type="text" id="afCustomNote" class="field" placeholder="Or specify custom fallout details (optional)..." style="margin-top:10px;width:100%" />
    </div>

    <div class="modal-actions">
      <button class="btn ghost" data-act="new">New session</button>
      <button class="btn primary big" data-act="reassemble">Reassemble 5 Hours Later</button>
    </div>`,
  {
    dismissable: false,
    onMount: (m) => {
      const radios = m.querySelectorAll('input[name=aftermathOpt]');
      radios.forEach((r) => {
        r.onchange = () => {
          m.querySelectorAll('.af-choice').forEach((c) => c.classList.toggle('is-selected', c.querySelector('input').checked));
        };
      });
      m.querySelector('[data-act=reassemble]').onclick = () => {
        const sel = m.querySelector('input[name=aftermathOpt]:checked')?.value || 'total_failure';
        const customNote = m.querySelector('#afCustomNote')?.value.trim();
        const titles = {
          total_failure: 'Total Failure',
          pyrrhic: 'Pyrrhic Compromise',
          fragile_truce: 'Fragile Order',
          breakthrough: 'Decisive Breakthrough',
        };
        const descs = {
          total_failure: 'Catastrophic collapse across the sector. Auxiliary systems failed and panic ignited.',
          pyrrhic: 'The decision was enforced, but at ruinous collateral cost and bitter resentment.',
          fragile_truce: 'A precarious calm held, but mistrust and covert sabotage simmer underneath.',
          breakthrough: 'The strategy operated cleanly, averting disaster and earning hard-won relief.',
        };
        const title = titles[sel];
        const desc = customNote || descs[sel];

        hud.closeModal();
        stage.clearBallots();
        c.clearBallots();

        sfx.alarm?.();
        hud.showReassembleBanner?.(title, desc, 5);
        c.applyAftermath({ outcomeId: sel, outcomeTitle: title, outcomeDesc: desc, hoursLater: 5 });
        syncAll();
        hud.toast(`The council reconvenes 5 hours after the vote: ${title}. Tension is at ${c.tension}.`, 'warn', 6000);
      };
      m.querySelector('[data-act=new]').onclick = () => { hud.closeModal(); leaveSession(); };
    },
  });
}

// ------------------------------------------------------------------ settings + leave
function openSettings() {
  const o = health.ollama;
  const draft = { ...settings };
  const radio = (name, value, label) => `<button data-${name}="${value}" class="${draft[name] === value ? 'is-selected' : ''}">${label}</button>`;
  hud.modal(`
    <h2>SETTINGS</h2>
    <div class="settings-grid">
      <div class="row">Thinking engine <div class="radio-row" data-group="engine">${radio('engine', 'ollama', 'Local GPU (Ollama)')}${radio('engine', 'claude', 'Claude API')}${radio('engine', 'offline', 'Offline scripted')}</div></div>
      <div class="row">Local model <select class="sel" id="setOllama" ${o.ok ? '' : 'disabled'}>${(o.models || []).map((m) => `<option value="${esc(m.name)}" ${m.name === draft.ollamaModel ? 'selected' : ''}>${esc(m.name)} ${m.params ? `· ${esc(m.params)}` : ''}</option>`).join('') || '<option>Ollama not reachable</option>'}</select></div>
      <div class="row">Claude model <select class="sel" id="setClaude">${(health.claude.models || []).map((m) => `<option value="${m.id}" ${m.id === draft.claudeModel ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select></div>
      <div class="row">Claude API key <input class="field" id="setKey" type="password" placeholder="${health.claude.envCredentials ? 'Server credentials detected; optional' : 'sk-ant-… (kept for this browser tab only)'}" value="${esc(draft.apiKey || '')}" autocomplete="off" /></div>
      <div class="note">The key is sent only to the local game server, which calls Anthropic for you. It is not written to disk.</div>
      <div class="row">Spoken voices <div class="radio-row">${radio('voices', true, 'On')}${radio('voices', false, 'Off')}</div></div>
      <div class="row">Sound effects <input type="range" id="setVol" min="0" max="1" step="0.05" value="${draft.sound ? draft.volume : 0}" /></div>
      <div class="row">Graphics <div class="radio-row">${radio('quality', 'high', 'High (bloom)')}${radio('quality', 'low', 'Low')}</div></div>
      <div class="row">Private thoughts <div class="radio-row">${radio('minds', true, 'Revealed')}${radio('minds', false, 'Hidden')}</div></div>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-act="cancel">Cancel</button><button class="btn primary" data-act="save">Save</button></div>`,
  {
    onMount: (m) => {
      m.querySelectorAll('.radio-row button').forEach((b) => b.addEventListener('click', (ev) => {
        ev.preventDefault();
        const [k, raw] = Object.entries(b.dataset)[0];
        draft[k] = raw === 'true' ? true : raw === 'false' ? false : raw;
        b.parentElement.querySelectorAll('button').forEach((x) => x.classList.toggle('is-selected', x === b));
      }));
      m.querySelector('[data-act=cancel]').onclick = () => hud.closeModal();
      m.querySelector('[data-act=save]').onclick = () => {
        const vol = parseFloat(m.querySelector('#setVol').value);
        const ollamaSel = m.querySelector('#setOllama');
        Object.assign(settings, {
          engine: draft.engine,
          ollamaModel: o.ok && ollamaSel.value ? ollamaSel.value : settings.ollamaModel,
          claudeModel: m.querySelector('#setClaude').value,
          apiKey: m.querySelector('#setKey').value.trim(),
          quality: draft.quality,
          volume: vol || settings.volume,
          sound: vol > 0,
        });
        if (settings.engine === 'ollama' && !(o.ok && o.models.length)) { settings.engine = 'offline'; hud.toast('Ollama is not reachable, so the offline engine stays on.', 'warn'); }
        sfx.setEnabled(settings.sound);
        sfx.setVolume(settings.volume);
        stage.setQuality(settings.quality);
        setVoices(draft.voices, true);
        setMinds(draft.minds, true);
        saveSettings();
        hud.setEngine(settings);
        hud.closeModal();
        hud.toast(`Engine: ${settings.engine === 'ollama' ? settings.ollamaModel : settings.engine === 'claude' ? settings.claudeModel : 'offline scripted'}.`);
      };
    },
  });
}

function confirmLeave() {
  hud.modal(`<h2>ADJOURN THE SESSION?</h2><p style="color:var(--muted);line-height:1.6">The council will adjourn and this debate will end. You can convene a new session from the main screen.</p>
    <div class="modal-actions"><button class="btn ghost" data-act="stay">Stay</button><button class="btn danger" data-act="leave">Adjourn</button></div>`, {
    onMount: (m) => {
      m.querySelector('[data-act=stay]').onclick = () => hud.closeModal();
      m.querySelector('[data-act=leave]').onclick = () => { hud.closeModal(); leaveSession(); };
    },
  });
}

function leaveSession() {
  council?.destroy();
  council = null;
  voices.cancel();
  stage.clearSpeaker();
  stage.clearBallots();
  stage.setSelected(null);
  stage.setWebVisible(false);
  stage.cam.setMode('overview');
  hud.closePopover();
  hud.hideSubtitle(true);
  hud.hideVotePanel();
  document.body.classList.add('at-start');
  hud.showStart();
  refreshHealth();
}

// ------------------------------------------------------------------ keyboard
window.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === 'Escape') {
    if (hud.modalOpen && hud.modalDismissable) hud.closeModal();
    else hud.closePopover();
    document.activeElement?.blur?.();
    return;
  }
  if (typing || !council || hud.modalOpen || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const map = {
    ' ': () => (council.auto ? council.pause() : council.play()),
    n: () => { council.pause(); council.step(); },
    g: () => openLever('gavel'), p: () => openLever('carrier'), c: () => openLever('crisis'), w: () => openLever('whisper'), v: () => openLever('vote'),
    1: () => hud.cb.onCamera('overview'), 2: () => hud.cb.onCamera('focus'), 3: () => hud.cb.onCamera('free'),
    m: () => setMinds(!settings.minds), a: () => setWeb(!settings.web),
  };
  if (map[k]) { e.preventDefault(); map[k](); }
});

// Handy for debugging from the console.
window.halcyon = { get council() { return council; }, stage, settings, hud };
