/**
 * One study debate: two archetype debaters, five blank listeners, N rounds.
 *
 *   round 1   both openings are written blind (prepared statements), A is heard first
 *   round 2.. A answers, then B answers having heard A; the last round is closings
 *   after each round every listener reflects on the two new speeches and leans;
 *   after the last round the reflection ends in a forced-choice vote.
 *
 * Listeners are independent: they never see each other's notes, and each has its
 * own seed. Speaker A always speaks first in every round; which TYPE is A is
 * counterbalanced by the schedule, so first-speaker advantage can be measured.
 */
import { chat } from './ollama.mjs';
import { typeById, NAMES } from './archetypes.mjs';
import { scenarioById } from './scenarios.mjs';
import {
  roundName, debaterSystem, debaterTurnPrompt, OPENING_SCHEMA, TURN_SCHEMA,
  listenerSystem, listenerRoundPrompt, listenerSchema,
} from './prompts.mjs';

export const PROTOCOL = 2; // 1 = fully blind openings (debates 1-37 of run main); 2 = contrast rule

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean).length;
const first = (n) => n.split(' ')[0];

export async function runDebate(spec, cfg, log = () => {}) {
  const sc = scenarioById(spec.scenarioId);
  const tA = typeById(spec.typeA);
  const tB = typeById(spec.typeB);
  const R = cfg.rounds;
  const rand = rng(spec.seed);
  const pool = [...NAMES];
  const nameA = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const nameB = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const t0 = Date.now();
  const calls = [];
  let seedN = spec.seed * 1000;
  const nextSeed = () => ++seedN;

  const debaters = {
    A: { type: tA, name: nameA, opp: nameB, system: debaterSystem(sc, tA, nameA, nameB), platform: null, strategies: [] },
    B: { type: tB, name: nameB, opp: nameA, system: debaterSystem(sc, tB, nameB, nameA), platform: null, strategies: [] },
  };
  const transcript = [];
  const nL = cfg.listeners;
  const profiles = cfg.listenerProfiles || [];
  const listeners = Array.from({ length: nL }, (_, i) => ({
    id: `L${i + 1}`,
    profile: profiles[i] || null,
    system: listenerSystem(sc, nameA, nameB, R, profiles[i] || null),
    memory: [],
  }));

  const validSpeech = (j) => (words(j.speech) < 25 ? `speech too short (${words(j.speech)} words)` : null);

  // which side drafts its platform blind (the other must differ); independent of speaking order
  const drafter = rng(spec.seed + 17)() < 0.5 ? 'A' : 'B';

  async function speak(side, round, rivalPlatform = null) {
    const d = debaters[side];
    const opening = round === 1;
    const res = await chat({
      model: cfg.debaterModel,
      system: d.system,
      prompt: debaterTurnPrompt({
        round, totalRounds: R, me: d.name, opp: d.opp, platform: d.platform,
        // blind openings: neither side hears the other before its own opening
        transcript: opening ? [] : transcript,
        speaksFirst: side === 'A',
        rivalPlatform,
      }),
      schema: opening ? OPENING_SCHEMA : TURN_SCHEMA,
      temperature: cfg.debaterTemperature,
      seed: nextSeed(),
      numPredict: 600,
      validate: validSpeech,
    });
    if (opening) d.platform = res.json.platform;
    d.strategies.push({ round, text: res.json.strategy });
    const entry = { round, roundName: roundName(round, R), side, name: d.name, type: d.type.id, speech: res.json.speech.trim(), words: words(res.json.speech) };
    if (!opening) transcript.push(entry); // openings are pushed in speaking order below
    calls.push({ role: 'debater', side, round, model: res.model, seed: res.seed, attempts: res.attempts, tokensIn: res.tokensIn, tokensOut: res.tokensOut, ms: res.ms });
    return entry;
  }

  async function listen(round, speechA, speechB) {
    const final = round === R;
    const schema = listenerSchema(nameA, nameB, final);
    for (const L of listeners) {
      const res = await chat({
        model: cfg.listenerModel,
        system: L.system,
        prompt: listenerRoundPrompt({ round, totalRounds: R, nameA, nameB, speechA, speechB, memory: L.memory }),
        schema,
        temperature: cfg.listenerTemperature,
        seed: nextSeed(),
        numPredict: 600,
        validate: (j) => (final ? ([nameA, nameB].includes(j.vote) ? null : `bad vote ${j.vote}`)
          : ([nameA, nameB, 'undecided'].includes(j.lean) ? null : `bad lean ${j.lean}`)),
      });
      const j = res.json;
      const m = {
        round, roundName: roundName(round, R),
        notes: j.notes, problem: j.problem,
        onA: j[`about_${first(nameA)}`] ?? '', onB: j[`about_${first(nameB)}`] ?? '',
        lean: final ? j.vote : j.lean, firmness: final ? 'vote' : j.firmness, vote: final ? j.vote : null,
        why: j.why,
      };
      // the side letter is what analysis uses; names are only for the prompts
      m.leanSide = m.lean === nameA ? 'A' : m.lean === nameB ? 'B' : 'U';
      L.memory.push(m);
      calls.push({ role: 'listener', listener: L.id, round, model: res.model, seed: res.seed, attempts: res.attempts, tokensIn: res.tokensIn, tokensOut: res.tokensOut, ms: res.ms });
    }
    const tally = { A: 0, B: 0, U: 0 };
    for (const L of listeners) tally[L.memory[L.memory.length - 1].leanSide]++;
    log(`    ${roundName(round, R)}: leans A=${tally.A} B=${tally.B} undecided=${tally.U}`);
    return tally;
  }

  const roundTallies = [];
  for (let r = 1; r <= R; r++) {
    let a; let b;
    if (r === 1) {
      const other = drafter === 'A' ? 'B' : 'A';
      const first = await speak(drafter, 1);
      const second = await speak(other, 1, debaters[drafter].platform);
      [a, b] = drafter === 'A' ? [first, second] : [second, first];
      transcript.push(a, b);
    } else {
      a = await speak('A', r);
      b = await speak('B', r);
    }
    roundTallies.push(await listen(r, a.speech, b.speech));
  }

  const final = roundTallies[roundTallies.length - 1];
  const winner = final.A > final.B ? 'A' : final.B > final.A ? 'B' : 'tie';
  const totals = calls.reduce((acc, c) => ({ in: acc.in + c.tokensIn, out: acc.out + c.tokensOut, retries: acc.retries + c.attempts - 1 }), { in: 0, out: 0, retries: 0 });
  return {
    id: spec.id,
    pass: spec.pass,
    pairIndex: spec.pairIndex,
    seed: spec.seed,
    scenario: sc.id,
    scenarioVersion: sc.version || 1,
    domain: sc.domain,
    protocol: PROTOCOL,
    draftFirst: drafter,
    rounds: R,
    A: { type: tA.id, style: tA.style, ideology: tA.ideology, name: nameA, platform: debaters.A.platform, strategies: debaters.A.strategies },
    B: { type: tB.id, style: tB.style, ideology: tB.ideology, name: nameB, platform: debaters.B.platform, strategies: debaters.B.strategies },
    models: { debater: cfg.debaterModel, listener: cfg.listenerModel },
    temperatures: { debater: cfg.debaterTemperature, listener: cfg.listenerTemperature },
    listenerProfiles: profiles.length ? profiles : null,
    transcript,
    listeners: listeners.map((L) => ({ id: L.id, profile: L.profile, memory: L.memory })),
    roundTallies,
    votes: { A: final.A, B: final.B },
    winner,
    winnerType: winner === 'A' ? tA.id : winner === 'B' ? tB.id : null,
    tokens: totals,
    calls,
    startedAt: new Date(t0).toISOString(),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}

/** Human-readable transcript for the log folder. */
export function toMarkdown(rec) {
  const L = [];
  L.push(`# ${rec.id}`);
  L.push('');
  L.push(`Scenario **${rec.scenario}** v${rec.scenarioVersion || 1} (${rec.domain}) · protocol ${rec.protocol || 1}, ${rec.draftFirst || '-'} drafted its plan first · pass ${rec.pass} · ${rec.rounds} rounds · ${rec.seconds}s · debater ${rec.models.debater}, listeners ${rec.models.listener}`);
  L.push('');
  L.push(`- **A** (speaks first): ${rec.A.name} = \`${rec.A.type}\`. Platform: ${rec.A.platform}`);
  L.push(`- **B**: ${rec.B.name} = \`${rec.B.type}\`. Platform: ${rec.B.platform}`);
  L.push('');
  L.push(`**Result:** A ${rec.votes.A} – ${rec.votes.B} B → winner **${rec.winner === 'tie' ? 'tie' : `${rec.winner} (${rec.winnerType})`}**`);
  L.push(`Leans per round (A/B/undecided): ${rec.roundTallies.map((t) => `${t.A}/${t.B}/${t.U}`).join(' → ')}`);
  L.push('');
  L.push('## Transcript');
  for (const t of rec.transcript) {
    L.push('');
    L.push(`**${t.roundName}: ${t.name} (${t.side}, ${t.type})**, ${t.words} words`);
    L.push('');
    L.push(t.speech);
  }
  L.push('');
  L.push('## Private strategies');
  for (const side of ['A', 'B']) for (const s of rec[side].strategies) L.push(`- ${side} r${s.round}: ${s.text}`);
  L.push('');
  L.push('## Listener memory streams');
  for (const l of rec.listeners) {
    L.push('');
    L.push(`### ${l.id}${l.profile ? ` (${l.profile})` : ''}`);
    for (const m of l.memory) {
      L.push(`- **${m.roundName}** → ${m.vote ? `VOTE ${m.vote}` : `lean ${m.lean} (${m.firmness})`}`);
      L.push(`  - notes: ${m.notes}`);
      L.push(`  - problem: ${m.problem}`);
      L.push(`  - on A: ${m.onA}`);
      L.push(`  - on B: ${m.onB}`);
      L.push(`  - why: ${m.why}`);
    }
  }
  return L.join('\n');
}
