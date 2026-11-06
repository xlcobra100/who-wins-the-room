/**
 * Post-hoc (exploratory): does the debater TYPE win, or the PLAN it picked?
 *   node plan-analysis.mjs --run main [--protocol 2]   (needs runs/<run>/plans.json from classify-plans.mjs)
 *   -> prints a markdown section and writes runs/<run>/plan-analysis.json
 *
 * Model 1: P(vote A) = s(first + style[A]-style[B] + ideo[A]-ideo[B])            (as in analyze.mjs)
 * Model 2: same + plan[A]-plan[B], plan levels nested in scenario (e.g. dam:LOWER)
 * If the ideology effects shrink a lot from model 1 to model 2, ideology works mainly
 * through which plan the debater picks; if style survives, style is about delivery.
 * 95% CIs: bootstrap over whole debates (the 5 votes of a debate are not independent).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rng } from './debate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.join(HERE, 'runs', arg('run', 'main'));
const PROTO = arg('protocol');
const plans = JSON.parse(readFileSync(path.join(DIR, 'plans.json'), 'utf8'));
let rows = readFileSync(path.join(DIR, 'results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (PROTO) rows = rows.filter((r) => String(r.protocol || 1) === PROTO);
rows = rows.filter((r) => plans[r.id]);
for (const r of rows) { r.planA = `${r.scenario}:${plans[r.id].A}`; r.planB = `${r.scenario}:${plans[r.id].B}`; }

const pct = (x) => `${Math.round(100 * x)}%`;
const f2 = (x) => x.toFixed(2);
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(q * (s.length - 1))]; };

function fit(rs, withPlan) {
  const th = { first: 0 };
  const feats = (r, side) => {
    const s = side === 'A' ? 'A' : 'B';
    const f = [`s:${r[`style${s}`]}`, `i:${r[`ideo${s}`]}`];
    if (withPlan) f.push(`p:${r[`plan${s}`]}`);
    return f;
  };
  for (const r of rs) for (const k of [...feats(r, 'A'), ...feats(r, 'B')]) th[k] = 0;
  const lr = 0.05; const l2 = 0.02; const N = rs.reduce((a, r) => a + r.votesA + r.votesB, 0);
  for (let it = 0; it < 2500; it++) {
    const g = Object.fromEntries(Object.keys(th).map((k) => [k, -l2 * th[k]]));
    for (const r of rs) {
      const fa = feats(r, 'A'); const fb = feats(r, 'B');
      const z = th.first + fa.reduce((a, k) => a + th[k], 0) - fb.reduce((a, k) => a + th[k], 0);
      const p = 1 / (1 + Math.exp(-z));
      const resid = (r.votesA - (r.votesA + r.votesB) * p) / N * 50;
      g.first += resid; for (const k of fa) g[k] += resid; for (const k of fb) g[k] -= resid;
    }
    for (const k of Object.keys(th)) th[k] += lr * g[k];
  }
  // centre within each factor (and within scenario for plans): only differences are identified
  const groups = {};
  for (const k of Object.keys(th)) if (k !== 'first') { const grp = k.startsWith('p:') ? k.split(':').slice(0, 2).join(':') : k.slice(0, 2); (groups[grp] ??= []).push(k); }
  for (const ks of Object.values(groups)) { const m = ks.reduce((a, k) => a + th[k], 0) / ks.length; for (const k of ks) th[k] -= m; }
  return th;
}

function boot(rs, withPlan, B = 120) {
  const rand = rng(4242); const out = [];
  for (let b = 0; b < B; b++) out.push(fit(Array.from({ length: rs.length }, () => rs[Math.floor(rand() * rs.length)]), withPlan));
  return out;
}

const m1 = fit(rows, false); const m2 = fit(rows, true);
const b1 = boot(rows, false); const b2 = boot(rows, true);
const ci = (bs, k) => [quant(bs.map((t) => t[k] ?? 0), 0.025), quant(bs.map((t) => t[k] ?? 0), 0.975)];

const L = [];
L.push(`## Plan vs type (exploratory, ${rows.length} debates${PROTO ? `, protocol ${PROTO}` : ''})`);
L.push('');
const same = rows.filter((r) => r.planA === r.planB).length;
L.push(`Both debaters' platforms fell in the same plan category in ${same} of ${rows.length} debates (${pct(same / rows.length)}).`);
L.push('');
L.push('**Plan vote share** (debates where the two plans differ) and which ideology picks it:');
L.push('');
L.push('| plan | vote share | times picked | REA | PRA | LIB | IDE |');
L.push('|---|---|---|---|---|---|---|');
const pl = {};
for (const r of rows) for (const s of ['A', 'B']) {
  const p = r[`plan${s}`]; pl[p] ??= { f: 0, a: 0, n: 0, ideo: { REA: 0, PRA: 0, LIB: 0, IDE: 0 } };
  pl[p].n++; pl[p].ideo[r[`ideo${s}`]]++;
  if (r.planA !== r.planB) { pl[p].f += s === 'A' ? r.votesA : r.votesB; pl[p].a += r.votesA + r.votesB; }
}
for (const p of Object.keys(pl).sort()) {
  const x = pl[p];
  L.push(`| ${p} | ${x.a ? pct(x.f / x.a) : '–'} | ${x.n} | ${x.ideo.REA} | ${x.ideo.PRA} | ${x.ideo.LIB} | ${x.ideo.IDE} |`);
}
L.push('');
L.push('**Effects with and without controlling for the plan** (log-odds, 95% bootstrap CI over debates):');
L.push('');
L.push('| effect | type only | type + plan |');
L.push('|---|---|---|');
const keys = ['first', 's:POP', 's:HYB', 's:TEC', 'i:REA', 'i:PRA', 'i:LIB', 'i:IDE'];
for (const k of keys) {
  const c1 = ci(b1, k); const c2 = ci(b2, k);
  L.push(`| ${k} | ${f2(m1[k])} (${f2(c1[0])} … ${f2(c1[1])}) | ${f2(m2[k])} (${f2(c2[0])} … ${f2(c2[1])}) |`);
}
L.push('');
const sd = (th, pre) => { const v = Object.keys(th).filter((k) => k.startsWith(pre)).map((k) => th[k]); return Math.sqrt(v.reduce((a, x) => a + x * x, 0) / v.length); };
L.push(`Spread (SD of the centred effects): style ${f2(sd(m1, 's:'))} → ${f2(sd(m2, 's:'))}; ideology ${f2(sd(m1, 'i:'))} → ${f2(sd(m2, 'i:'))}; plan (within scenario) ${f2(sd(m2, 'p:'))}.`);
const out = L.join('\n');
console.log(out);
writeFileSync(path.join(DIR, `plan-analysis${PROTO ? `-p${PROTO}` : ''}.json`), JSON.stringify({ n: rows.length, same, plans: pl, typeOnly: m1, typePlusPlan: m2 }, null, 1));
writeFileSync(path.join(DIR, `plan-analysis${PROTO ? `-p${PROTO}` : ''}.md`), out);
