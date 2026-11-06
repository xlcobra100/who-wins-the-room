/**
 * Post-hoc: code every debater platform into a plan category for its scenario, so the
 * analysis can ask "does the type win, or does the plan it picked win?".
 *   node classify-plans.mjs --run main      -> runs/<run>/plans.json  { [debateId]: {A, B} }
 *
 * The categories were defined after reading the platforms of run main (wrap-up, 2026-11-05),
 * so this is exploratory, not pre-registered. Coding uses the same local model at
 * temperature 0 with a fixed seed; spot-check a sample by hand before trusting it.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat } from './ollama.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.join(HERE, 'runs', arg('run', 'main'));

export const PLAN_CATEGORIES = {
  dam: {
    LOWER: 'lower the reservoir (to about 30%) and/or install a new spillway as the core move',
    REBUILD: 'fund the full rebuild of the dam as the core move',
    RELOCATE: 'relocate the Riverside residents (possibly with sirens / warnings) as the core move, without lowering the reservoir now',
    NEGOTIATE: 'keep the reservoir level for now and negotiate or phase a deal with Ostbrück / Nordhalm / the mill first',
    OTHER: 'none of the above',
  },
  salient: {
    WITHDRAW: 'withdraw the brigade (and civilians) across the bridge now / tonight, fighting or covered withdrawal',
    HOLD: 'hold Halden and fight, waiting for allies or aid, no planned withdrawal',
    HOLD_BUILD: 'hold Halden only for a few days while building the pontoon crossing / evacuating civilians, then withdraw or resupply',
    CEASEFIRE: "accept or negotiate Vostra's ceasefire / a negotiated evacuation",
    OTHER: 'none of the above',
  },
  board: {
    SELL: 'accept the Crestline Capital buyout / sell the company',
    KEEP_INVEST: 'reject the sale, keep both plants open, invest in Volt-One or restructure in-house',
    HALBERG: 'merge with Halberg',
    OFFSHORE_CUT: 'move production to a contract manufacturer abroad and/or close a plant, as a cost cut without selling',
    OTHER: 'none of the above',
  },
  river: {
    DEAL: "accept Saradan's slower (seven-year) fill in exchange for buying their electricity / a power purchase agreement",
    MULTILATERAL: 'refuse or postpone the power deal and go to the Regional Union, a court, mediation or a joint-management treaty first',
    HARDLINE: 'reject the deal and use pressure: military mobilisation, sanctions, a coalition against Saradan, threats',
    OTHER: 'none of the above',
  },
};

async function classify(scenario, platform, seed) {
  const cats = PLAN_CATEGORIES[scenario];
  const res = await chat({
    model: 'qwen3.5:9b',
    system: 'You code short policy proposals into one category. Pick the category that matches the proposal\'s CORE choice (its first and main action). Answer with JSON only.',
    prompt: `Categories:\n${Object.entries(cats).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nProposal: "${platform}"\n\nWhich category is its core choice?`,
    schema: { type: 'object', properties: { category: { type: 'string', enum: Object.keys(cats) } }, required: ['category'] },
    temperature: 0, seed, numPredict: 40,
    validate: (j) => (Object.keys(cats).includes(j.category) ? null : `bad category ${j.category}`),
  });
  return res.json.category;
}

const out = existsSync(path.join(DIR, 'plans.json')) ? JSON.parse(readFileSync(path.join(DIR, 'plans.json'), 'utf8')) : {};
const rows = readFileSync(path.join(DIR, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
let k = 0;
for (const r of rows) {
  if (out[r.id]) continue;
  const d = JSON.parse(readFileSync(path.join(DIR, 'debates', `${r.id}.json`), 'utf8'));
  out[r.id] = {
    scenario: r.scenario,
    A: await classify(r.scenario, d.A.platform, 1000 + k++),
    B: await classify(r.scenario, d.B.platform, 1000 + k++),
  };
  if (k % 20 === 0) { writeFileSync(path.join(DIR, 'plans.json'), JSON.stringify(out, null, 1)); console.log(`${Object.keys(out).length}/${rows.length}`); }
}
writeFileSync(path.join(DIR, 'plans.json'), JSON.stringify(out, null, 1));
console.log(`done: ${Object.keys(out).length} debates coded`);
