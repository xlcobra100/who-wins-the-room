/**
 * Headless engine test: runs every pre-loaded scenario (plus a custom one) on the
 * offline engine through a full session (debate, whisper, gavel, crisis and
 * vote) and checks the core invariants. Run with `npm test`.
 * Pass --live to also exercise one real Ollama turn through a running dev server
 * (expects http://localhost:5180).
 */
import assert from 'node:assert/strict';
import { Council, sanitizeSpeech, nameOptions } from '../src/engine/council.js';
import { PERSONAS } from '../src/data/personas.js';
import { SCENARIOS, makeCustomScenario } from '../src/data/scenarios.js';

const BREAK_RE = /\b(as an ai|language model|i am an ai|simulation|role-?play)\b/i;
const until = async (pred, ms = 8000) => {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error('timed out waiting for condition');
    await new Promise((r) => setTimeout(r, 5));
  }
};

async function runSession(scenario) {
  const c = new Council({ scenario, personas: PERSONAS, llm: null, speed: 4 });
  c.offlineDelay = 0;
  c.gapMs = () => 0;
  c.playback = async () => {};
  const speeches = () => c.transcript.filter((e) => e.kind === 'speech');
  c.start();
  c.play();
  await until(() => speeches().length >= 6);
  assert.equal(speeches()[0].speakerId, scenario.opener, 'opener speaks first');

  // Whisper: the target should champion it within a handful of turns.
  const target = 'celeste';
  const w = scenario.whispers[0];
  c.whisper(target, w.text, w.favors);
  await until(() => speeches().some((e) => e.speakerId === target && e.championed));
  if (w.favors) assert.equal(c.agents.get(target).memory.stance.position, w.favors, 'whisper moved stance');

  // Gavel addressed to one member: they answer next.
  c.gavel('Kestrel, what would your people actually accept?');
  const afterGavel = c.transcript.length;
  await until(() => c.transcript.slice(afterGavel).some((e) => e.kind === 'speech'));
  const firstReply = c.transcript.slice(afterGavel).find((e) => e.kind === 'speech');
  assert.equal(firstReply.speakerId, 'kestrel', 'addressed member replies to the Chair');
  assert.equal(firstReply.moment, 'chair');

  // Crisis: the room reacts.
  const tensionBefore = c.tension;
  c.crisis(scenario.crises[0]);
  assert.ok(c.tension > tensionBefore, 'crisis raises tension');
  const afterCrisis = c.transcript.length;
  await until(() => c.transcript.slice(afterCrisis).filter((e) => e.kind === 'speech' && e.moment === 'crisis').length >= 2);

  // Carrier dispatch: public intel sent via drone to the entire room.
  c.carrierDispatch({ title: 'Telemetry Update', text: 'Scrubber core online', favors: 'A' });
  const afterCarrier = c.transcript.length;
  await until(() => c.transcript.slice(afterCarrier).some((e) => e.kind === 'speech' && e.moment === 'carrier'));
  const carrierReply = c.transcript.slice(afterCarrier).find((e) => e.kind === 'speech');
  assert.equal(carrierReply.moment, 'carrier', 'member replies to carrier dispatch');

  c.pause();
  const opt = scenario.options[0];
  const vote = await c.callVote({ text: `${opt.label}: ${opt.desc}`, optionId: opt.id });
  assert.ok(vote, 'vote completes');
  assert.equal(vote.tally.aye + vote.tally.nay + vote.tally.abstain, c.agentList.length, 'all ballots cast');
  assert.ok(vote.epilogue?.headline && vote.epilogue?.epilogue, 'epilogue present');
  assert.equal(c.phase, 'debate', 'debate can continue after the vote');

  for (const e of speeches()) {
    assert.ok(e.text.length > 10, 'non-empty speech');
    assert.ok(!BREAK_RE.test(e.text), `no fourth-wall break: ${e.text}`);
    assert.ok([...scenario.options.map((o) => o.id), 'undecided'].includes(e.position), 'valid position');
  }
  for (const a of c.agentList) {
    for (const v of Object.values(a.memory.trust)) assert.ok(v >= -100 && v <= 100, 'trust in range');
    assert.ok(a.memory.thoughts.length > 0, 'private thoughts recorded');
    assert.ok(a.memory.episodic.length > 5, 'episodic memory recorded');
  }
  c.destroy();
  return { c, speeches: speeches(), vote };
}

const results = [];
for (const sc of [...SCENARIOS, makeCustomScenario('A rival station is offering asylum to our best engineers in exchange for our reactor designs.')]) {
  const r = await runSession(sc);
  results.push(r);
  console.log(`ok  ${sc.title.padEnd(28)} ${String(r.speeches.length).padStart(3)} turns  vote ${r.vote.text.slice(0, 40)}`);
}

// Sanitizer contract.
assert.equal(sanitizeSpeech('Vance: "We hold the line." *slams table* Then we move.'), 'We hold the line. Then we move.');
assert.equal(sanitizeSpeech('One. Two. Three. Four.'), 'One. Two. Three.');
assert.equal(nameOptions("those scrubbers could work. I'm looking at Option C.", SCENARIOS[0]), "Those scrubbers could work. I'm looking at the Strip the Refinery option.");

const sample = results[0].speeches.slice(0, 4).map((e) => `  ${e.speakerId.padEnd(8)} [${e.position}] ${e.text}\n           (thinks) ${e.thought}`).join('\n');
console.log(`\nSample offline exchange:\n${sample}\n`);

// Debate Arena test: 2 stage debaters duel, 5 audience members listen and sway.
const debateCouncil = new Council({ scenario: SCENARIOS[0], personas: PERSONAS, llm: null, speed: 4, mode: 'debate', debaters: ['vance', 'kestrel'] });
debateCouncil.offlineDelay = 0;
debateCouncil.gapMs = () => 0;
debateCouncil.playback = async () => {};
const debateSpeeches = () => debateCouncil.transcript.filter((e) => e.kind === 'speech');
debateCouncil.start();
debateCouncil.play();
await until(() => debateSpeeches().length >= 4);
debateCouncil.pause();
assert.equal(debateSpeeches()[0].speakerId, 'vance', 'debater 1 opens on stage');
assert.equal(debateSpeeches()[1].speakerId, 'kestrel', 'debater 2 responds');
assert.equal(debateSpeeches()[2].speakerId, 'vance', 'debater 1 rebuts');
assert.equal(debateSpeeches()[3].speakerId, 'kestrel', 'debater 2 answers');
assert.ok(debateSpeeches().some((e) => e.sways && e.sways.length > 0), 'audience jury swayed by rhetoric');
debateCouncil.destroy();
console.log('ok  Debate Arena Mode           4 turns  stage duel + audience rhetoric sway passed');

// Initials and titles are not sentence ends ("U. S. Steel" used to cut the line short).
assert.equal(
  sanitizeSpeech('Moore will fail. U. S. Steel can buy the shares. Mr. Morgan agrees. That is all.'),
  'Moore will fail. U. S. Steel can buy the shares. Mr. Morgan agrees.',
);

// Turn-taking: over a long session nobody dominates and the order is not a fixed rotation
// (a live model used to settle into a 7-seat loop where each member only answered the previous one).
{
  const c = new Council({ scenario: SCENARIOS[0], personas: PERSONAS, llm: null, speed: 4 });
  c.offlineDelay = 0;
  c.gapMs = () => 0;
  c.playback = async () => {};
  c.start();
  c.play();
  await until(() => c.transcript.filter((e) => e.kind === 'speech').length >= 70, 20000);
  c.destroy();
  const order = c.transcript.filter((e) => e.kind === 'speech').map((e) => e.speakerId);
  const counts = {};
  for (const id of order) counts[id] = (counts[id] || 0) + 1;
  for (const p of PERSONAS) assert.ok((counts[p.id] || 0) >= 5, `${p.id} spoke at least 5 times in 70 turns (${counts[p.id] || 0})`);
  assert.ok(Math.max(...Object.values(counts)) / order.length <= 0.25, 'nobody takes more than a quarter of the turns');
  const cycle = order.slice(7).filter((id, i) => id === order[i]).length / (order.length - 7);
  assert.ok(cycle < 0.6, `speaking order is not a fixed rotation (${(cycle * 100).toFixed(0)}% repeat at lag 7)`);
  console.log(`ok  Turn-taking balance          70 turns  max share ${(Math.max(...Object.values(counts)) / order.length * 100).toFixed(0)}%, lag-7 repeat ${(cycle * 100).toFixed(0)}%`);
}

// 1900s scenarios: period cast, period setting, and no space-station vocabulary in any prompt.
{
  const { castFor, eraOf } = await import('../src/data/personas.js');
  const { buildSystemPrompt, buildTurnPrompt, chronicleSystem } = await import('../src/engine/prompts.js');
  const LEAK = /halcyon|space station|consortium|charter|ring c|directorate|lower deck|hull|biosphere|telemetry/i;
  for (const sc of SCENARIOS.filter((s) => s.theme === 'boardroom1900')) {
    assert.equal(eraOf(sc), '1900');
    assert.ok(sc.year && sc.world && sc.background?.length >= 3 && sc.stakes, `${sc.id} has period setting, background and stakes`);
    const c = new Council({ scenario: sc, personas: castFor('1900'), llm: null });
    for (const a of c.agentList) {
      assert.ok(sc.stakes[a.id], `${sc.id} explains what is at stake for ${a.id}`);
      const text = `${buildSystemPrompt(a, c)}\n${buildTurnPrompt(a, c, { kind: 'open' })}`;
      assert.ok(text.includes(String(sc.year)) && text.includes('WHAT EVERYONE IN THE ROOM KNOWS'), `${sc.id}/${a.id} prompt has year and background`);
      const leak = text.split('\n').find((l) => LEAK.test(l));
      assert.ok(!leak, `${sc.id}/${a.id} prompt leaks sci-fi wording: ${leak}`);
    }
    assert.ok(!LEAK.test(chronicleSystem(sc)), `${sc.id} chronicler is period-correct`);
  }
  for (const sc of SCENARIOS.filter((s) => !s.theme)) assert.ok(sc.background?.length >= 3 && sc.stakes, `${sc.id} has background and stakes`);
  assert.equal(castFor('1900').find((p) => p.id === 'vance').role, 'Colonel (ret.), Public Order');
  assert.equal(castFor('future'), PERSONAS);
  console.log('ok  1900s prompts                period cast, background, no sci-fi leaks');
}

// Near-verbatim self-repeats are caught so the model can be asked for something new.
{
  const c = new Council({ scenario: SCENARIOS[0], personas: PERSONAS, llm: null });
  const a = c.agents.get('chen');
  c.push({ kind: 'speech', speakerId: 'chen', text: 'Rivet, the certificates stop the run immediately without depleting our own gold reserves tonight.' });
  assert.ok(c.echoOf(a, 'Rivet, the certificates stop the run immediately without depleting our gold.'), 'echo detected');
  assert.equal(c.echoOf(a, 'We should ask Washington for more money before Monday morning comes.'), null, 'fresh line passes');
}

if (process.argv.includes('--live')) {
  const { LLMClient } = await import('../src/engine/llm.js');
  globalThis.fetch = ((orig) => (url, opts) => orig(url.startsWith('/') ? `http://localhost:5180${url}` : url, opts))(globalThis.fetch);
  const llm = new LLMClient({ engine: 'ollama', ollamaModel: process.env.OLLAMA_MODEL || '' });
  const c = new Council({ scenario: SCENARIOS[0], personas: PERSONAS, llm });
  c.playback = async () => {};
  const notices = [];
  c.on('notice', (n) => notices.push(n.text));
  c.start();
  c.step();
  await until(() => c.transcript.some((e) => e.kind === 'speech'), 60000);
  const e = c.transcript.find((x) => x.kind === 'speech');
  console.log(`live turn (${e.source}): ${e.speakerId}: ${e.text}\n  thinks: ${e.thought}`);
  assert.equal(e.source, 'llm', `live turn came from the model (notices: ${notices.join('; ')})`);
  c.destroy();
}
console.log('all engine tests passed');
