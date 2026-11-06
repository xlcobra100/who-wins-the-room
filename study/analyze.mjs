/**
 * Analysis for a study run:  node study/analyze.mjs --run <name>
 * Writes runs/<name>/report.md and report.json.
 *
 * Unit of evidence: one listener's final vote is one pairwise comparison between
 * the two debater types. A debate's 5 votes are NOT independent (same speeches, same
 * model), so every confidence interval is a bootstrap that resamples whole debates.
 *
 *  - per-type record, vote share and a Bradley-Terry strength (MM algorithm)
 *  - factorial logit: P(vote A) = s(first + style[A] - style[B] + ideo[A] - ideo[B])
 *    which separates the style effect, the ideology effect and the first-speaker effect
 *  - head-to-head matrix, scenario x style / ideology splits
 *  - persuasion dynamics from each listener's lean path across rounds
 *  - listener agreement (unanimity) and energy from power.csv / cpu.csv
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES, STYLES, IDEOLOGIES } from './archetypes.mjs';
import { SCENARIOS } from './scenarios.mjs';
import { rng } from './debate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg('run');
const DIR = path.join(HERE, 'runs', RUN);
const F = (n) => path.join(DIR, n);
const FILTER = arg('filter'); // optional: only rows whose listenerModel matches

let rows = readFileSync(F('results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const ALL_N = rows.length; // power.csv covers the whole run, so energy per debate divides by every debate, not the filtered cut
if (FILTER) rows = rows.filter((r) => r.listenerModel === FILTER || r.debaterModel === FILTER);
// --protocol 2 keeps only debates run under the contrast rule (v1 = debates 1-37 of run main)
const PROTO = arg('protocol');
if (PROTO) rows = rows.filter((r) => String(r.protocol || 1) === PROTO);
const main = rows.filter((r) => !r.profiles);
const OUT = arg("out", "report"); // --out report-p2 writes report-p2.md / .json, so several cuts can sit side by side

const pct = (x) => `${(100 * x).toFixed(0)}%`;
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const quant = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };

// ---------------------------------------------------------------- comparisons

/** Expand debates into listener-level comparisons {a, b, aWins} with a = first speaker. */
function comparisons(rs) {
  const out = [];
  for (const r of rs) {
    for (let k = 0; k < r.votesA; k++) out.push({ r, aWins: 1 });
    for (let k = 0; k < r.votesB; k++) out.push({ r, aWins: 0 });
  }
  return out;
}

function bradleyTerry(rs, ids, key = (r, s) => (s === 'A' ? r.typeA : r.typeB)) {
  const w = Object.fromEntries(ids.map((t) => [t, 0]));
  const games = {};
  for (const r of rs) {
    const a = key(r, 'A'); const b = key(r, 'B');
    if (a === b) continue;
    w[a] += r.votesA; w[b] += r.votesB;
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    games[k] = (games[k] || 0) + r.votesA + r.votesB;
  }
  let p = Object.fromEntries(ids.map((t) => [t, 1]));
  for (let it = 0; it < 500; it++) {
    const np = {};
    for (const i of ids) {
      let den = 0;
      for (const [k, n] of Object.entries(games)) {
        const [a, b] = k.split('|');
        if (a === i) den += n / (p[a] + p[b]);
        else if (b === i) den += n / (p[a] + p[b]);
      }
      // weak prior: one virtual win and one virtual loss against a fixed reference of
      // strength 1, so types with few or one-sided games stay finite and anchored
      np[i] = (w[i] + 1) / (den + 2 / (p[i] + 1));
    }
    p = np;
  }
  const g = Math.exp(ids.reduce((s, i) => s + Math.log(p[i]), 0) / ids.length);
  for (const i of ids) p[i] /= g;
  // Elo-like scale: 400*log10(p) so +100 ≈ 64% expected vote share against a 0 rated type
  return Object.fromEntries(ids.map((i) => [i, 400 * Math.log10(p[i])]));
}

/** Factorial logistic regression (gradient ascent, light L2). Sum-to-zero coding per factor. */
function factorial(rs) {
  const S = Object.keys(STYLES); const I = Object.keys(IDEOLOGIES);
  const th = { first: 0, ...Object.fromEntries(S.map((s) => [`s:${s}`, 0])), ...Object.fromEntries(I.map((i) => [`i:${i}`, 0])) };
  const data = [];
  for (const r of rs) {
    data.push({ r, y: 1, n: r.votesA }, { r, y: 0, n: r.votesB });
  }
  const lr = 0.05; const l2 = 0.01;
  for (let it = 0; it < 3000; it++) {
    const g = Object.fromEntries(Object.keys(th).map((k) => [k, -l2 * th[k]]));
    let N = 0;
    for (const { r, y, n } of data) {
      if (!n) continue;
      const z = th.first + th[`s:${r.styleA}`] - th[`s:${r.styleB}`] + th[`i:${r.ideoA}`] - th[`i:${r.ideoB}`];
      const e = n * (y - 1 / (1 + Math.exp(-z)));
      g.first += e; g[`s:${r.styleA}`] += e; g[`s:${r.styleB}`] -= e; g[`i:${r.ideoA}`] += e; g[`i:${r.ideoB}`] -= e;
      N += n;
    }
    for (const k of Object.keys(th)) th[k] += (lr * g[k]) / Math.max(1, N) * 10;
    // re-centre each factor (only differences are identified)
    const ms = S.reduce((a, s) => a + th[`s:${s}`], 0) / S.length; for (const s of S) th[`s:${s}`] -= ms;
    const mi = I.reduce((a, i) => a + th[`i:${i}`], 0) / I.length; for (const i of I) th[`i:${i}`] -= mi;
  }
  return th;
}

function bootstrap(rs, fn, B = 300, seed = 7) {
  const r = rng(seed);
  const outs = [];
  for (let b = 0; b < B; b++) outs.push(fn(rs.map(() => rs[Math.floor(r() * rs.length)])));
  return outs;
}

// ---------------------------------------------------------------- tables

function typeTable(rs) {
  const t = Object.fromEntries(TYPES.map((x) => [x.id, { debates: 0, wins: 0, losses: 0, ties: 0, votesFor: 0, votesAll: 0, firstRoundFor: 0, firstRoundAll: 0, gained: 0, lost: 0 }]));
  for (const r of rs) {
    for (const side of ['A', 'B']) {
      const id = side === 'A' ? r.typeA : r.typeB;
      const x = t[id];
      x.debates++;
      if (r.winner === 'tie') x.ties++; else if (r.winner === side) x.wins++; else x.losses++;
      x.votesFor += side === 'A' ? r.votesA : r.votesB;
      x.votesAll += r.votesA + r.votesB;
      for (const p of r.listenerPath) {
        const r1 = p[0]; const fin = p[p.length - 1];
        x.firstRoundAll++;
        if (r1 === side) x.firstRoundFor++;
        if (r1 !== side && fin === side) x.gained++;
        if (r1 === side && fin !== side) x.lost++;
      }
    }
  }
  return t;
}

function h2h(rs) {
  const m = {};
  for (const r of rs) {
    for (const [me, op, mine, theirs] of [[r.typeA, r.typeB, r.votesA, r.votesB], [r.typeB, r.typeA, r.votesB, r.votesA]]) {
      m[me] ??= {}; m[me][op] ??= { for: 0, all: 0, n: 0 };
      m[me][op].for += mine; m[me][op].all += mine + theirs; m[me][op].n++;
    }
  }
  return m;
}

function splitBy(rs, keyOf, levels, groupOf) {
  // vote share of each level (style or ideology) within each group (scenario)
  const out = {};
  for (const r of rs) {
    const g = groupOf(r);
    for (const side of ['A', 'B']) {
      const lv = keyOf(r, side);
      const o = keyOf(r, side === 'A' ? 'B' : 'A');
      if (lv === o) continue; // same level on both sides says nothing about the level
      out[g] ??= {}; out[g][lv] ??= { for: 0, all: 0 };
      out[g][lv].for += side === 'A' ? r.votesA : r.votesB;
      out[g][lv].all += r.votesA + r.votesB;
    }
  }
  return out;
}

function dynamics(rs) {
  let switches = 0; let transitions = 0; let undecided = [0, 0, 0, 0, 0]; let perRound = [0, 0, 0, 0, 0];
  let leaderHeld = 0; let leaderN = 0; let comebacks = 0;
  for (const r of rs) {
    for (const p of r.listenerPath) {
      for (let k = 0; k < p.length; k++) { perRound[k]++; if (p[k] === 'U') undecided[k]++; }
      for (let k = 1; k < p.length; k++) { transitions++; if (p[k] !== p[k - 1]) switches++; }
    }
    const [a1, b1] = r.leans[0].split('/').map(Number);
    if (a1 !== b1) {
      leaderN++;
      const lead = a1 > b1 ? 'A' : 'B';
      if (r.winner === lead) leaderHeld++; else if (r.winner !== 'tie') comebacks++;
    }
  }
  return { switchRate: switches / Math.max(1, transitions), undecidedByRound: undecided.map((u, k) => (perRound[k] ? u / perRound[k] : null)).filter((x) => x != null), leaderHeld: leaderHeld / Math.max(1, leaderN), comebacks, leaderN };
}

// ---------------------------------------------------------------- energy

function energy() {
  if (!existsSync(F('power.csv'))) return null;
  const pts = readFileSync(F('power.csv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => {
    const [ts, w, util, vram, temp] = l.split(',').map((s) => s.trim());
    return { t: Date.parse(ts.replace(/\//g, '-').replace(' ', 'T')), w: +w, util: +util, temp: +temp };
  }).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.w));
  if (pts.length < 2) return null;
  let wh = 0;
  for (let k = 1; k < pts.length; k++) {
    const dt = (pts[k].t - pts[k - 1].t) / 3600000;
    if (dt > 0 && dt < 0.01) wh += ((pts[k].w + pts[k - 1].w) / 2) * dt; // skip gaps > 36 s
  }
  const hours = (pts[pts.length - 1].t - pts[0].t) / 3600000;
  const cpu = existsSync(F('cpu.csv')) ? readFileSync(F('cpu.csv'), 'utf8').split('\n').slice(1).filter(Boolean).map((l) => +l.split(',')[1]) : [];
  const cpuAvg = cpu.length ? cpu.reduce((a, b) => a + b, 0) / cpu.length : null;
  return {
    hours, gpuWh: wh, gpuAvgW: wh / hours, gpuPeakW: Math.max(...pts.map((p) => p.w)),
    gpuAvgUtil: pts.reduce((a, p) => a + p.util, 0) / pts.length, maxTemp: Math.max(...pts.map((p) => p.temp)), cpuAvgUtil: cpuAvg,
  };
}

// ---------------------------------------------------------------- report

function build() {
  const rs = main;
  const n = rs.length;
  const comps = comparisons(rs);
  const firstShare = comps.reduce((a, c) => a + c.aWins, 0) / Math.max(1, comps.length);
  const tt = typeTable(rs);
  const ids = TYPES.map((t) => t.id);
  const bt = bradleyTerry(rs, ids);
  const btBoot = bootstrap(rs, (s) => bradleyTerry(s, ids), 200);
  const btCI = Object.fromEntries(ids.map((i) => [i, [quant(btBoot.map((b) => b[i]), 0.025), quant(btBoot.map((b) => b[i]), 0.975)]]));
  const fac = factorial(rs);
  const facBoot = bootstrap(rs, factorial, 150, 11);
  const facCI = Object.fromEntries(Object.keys(fac).map((k) => [k, [quant(facBoot.map((b) => b[k]), 0.025), quant(facBoot.map((b) => b[k]), 0.975)]]));
  const dist = { '5-0': 0, '4-1': 0, '3-2': 0 };
  for (const r of rs) { const hi = Math.max(r.votesA, r.votesB); dist[hi === 5 ? '5-0' : hi === 4 ? '4-1' : '3-2']++; }
  const dyn = dynamics(rs);
  const H = h2h(rs);
  const byScStyle = splitBy(rs, (r, s) => (s === 'A' ? r.styleA : r.styleB), Object.keys(STYLES), (r) => r.scenario);
  const byScIdeo = splitBy(rs, (r, s) => (s === 'A' ? r.ideoA : r.ideoB), Object.keys(IDEOLOGIES), (r) => r.scenario);
  const en = energy();
  const pairsCovered = {};
  for (const r of rs) { const k = [r.typeA, r.typeB].sort().join('|'); pairsCovered[k] = (pairsCovered[k] || 0) + 1; }
  const cover = Object.values(pairsCovered);

  const L = [];
  L.push(`# Persuasion study: results for run \`${RUN}\``);
  L.push('');
  L.push(`Generated ${new Date().toISOString()} from ${n} debates (${comps.length} listener votes)${FILTER ? `, filter ${FILTER}` : ''}.`);
  L.push(`Pairs covered: ${cover.length}/66; debates per pair min ${Math.min(...cover)}, max ${Math.max(...cover)}. Total model time ${(rs.reduce((a, r) => a + r.seconds, 0) / 3600).toFixed(2)} h, mean ${Math.round(rs.reduce((a, r) => a + r.seconds, 0) / Math.max(1, n))} s per debate.`);
  L.push('');
  L.push('## Ranking (Bradley-Terry on listener votes, 95% bootstrap CI over debates)');
  L.push('');
  L.push('| # | type | rating | 95% CI | debates | W-L-T | vote share | round-1 share | listeners gained / lost |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  [...ids].sort((a, b) => bt[b] - bt[a]).forEach((id, k) => {
    const x = tt[id];
    const t = TYPES.find((y) => y.id === id);
    L.push(`| ${k + 1} | **${id}** ${t.label} | ${bt[id].toFixed(0)} | ${btCI[id][0].toFixed(0)} … ${btCI[id][1].toFixed(0)} | ${x.debates} | ${x.wins}-${x.losses}-${x.ties} | ${pct(x.votesFor / Math.max(1, x.votesAll))} | ${pct(x.firstRoundFor / Math.max(1, x.firstRoundAll))} | +${x.gained} / −${x.lost} |`);
  });
  L.push('');
  L.push('Rating scale: a 100-point gap means the higher type is expected to win about 64% of listener votes against the lower one. "Round-1 share" is the share of listeners leaning to the type after the openings; "gained / lost" counts listeners who changed sides between round 1 and the final vote.');
  L.push('');
  L.push('## What drives it: style vs ideology vs speaking first (factorial logit, log-odds)');
  L.push('');
  L.push('| effect | estimate | 95% CI |');
  L.push('|---|---|---|');
  L.push(`| speaking first | ${f2(fac.first)} | ${f2(facCI.first[0])} … ${f2(facCI.first[1])} |`);
  for (const s of Object.keys(STYLES)) L.push(`| style ${s} (${STYLES[s].label}) | ${f2(fac[`s:${s}`])} | ${f2(facCI[`s:${s}`][0])} … ${f2(facCI[`s:${s}`][1])} |`);
  for (const i of Object.keys(IDEOLOGIES)) L.push(`| ideology ${i} (${IDEOLOGIES[i].label}) | ${f2(fac[`i:${i}`])} | ${f2(facCI[`i:${i}`][0])} … ${f2(facCI[`i:${i}`][1])} |`);
  L.push('');
  L.push(`Effects are centred within each factor (they sum to zero). A difference of 0.4 log-odds is roughly a 10-point swing in vote share. Raw first-speaker vote share: ${pct(firstShare)}.`);
  const dr = rs.filter((r) => r.draftFirst);
  if (dr.length) {
    const v = dr.reduce((a, r) => a + (r.draftFirst === 'A' ? r.votesA : r.votesB), 0) / dr.reduce((a, r) => a + r.votesA + r.votesB, 0);
    L.push(`Contrast rule (protocol 2, ${dr.length} debates): the side that drafted its plan first (blind, so it got its natural choice) won ${pct(v)} of votes.`);
  }
  L.push(`Debates by protocol: ${Object.entries(rs.reduce((a, r) => { const k = `v${r.protocol || 1}`; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  L.push('');
  L.push('## By scenario: vote share of each style and ideology (only debates where the two sides differ on that factor)');
  L.push('');
  L.push(`| scenario | ${Object.keys(STYLES).join(' | ')} | ${Object.keys(IDEOLOGIES).join(' | ')} |`);
  L.push(`|---|${Object.keys(STYLES).map(() => '---').join('|')}|${Object.keys(IDEOLOGIES).map(() => '---').join('|')}|`);
  for (const sc of SCENARIOS) {
    const s = byScStyle[sc.id] || {}; const i = byScIdeo[sc.id] || {};
    L.push(`| ${sc.id} (${sc.domain}) | ${Object.keys(STYLES).map((k) => (s[k] ? pct(s[k].for / s[k].all) : '–')).join(' | ')} | ${Object.keys(IDEOLOGIES).map((k) => (i[k] ? pct(i[k].for / i[k].all) : '–')).join(' | ')} |`);
  }
  L.push('');
  L.push('## Persuasion dynamics');
  L.push('');
  L.push(`- Listeners changed their lean in ${pct(dyn.switchRate)} of round-to-round transitions.`);
  L.push(`- Undecided by round: ${dyn.undecidedByRound.map(pct).join(' → ')} (the last round is a forced vote).`);
  L.push(`- When one side led after the openings (${dyn.leaderN} debates), it won ${pct(dyn.leaderHeld)} of them; ${dyn.comebacks} were comebacks.`);
  L.push(`- Final splits: 5-0 in ${dist['5-0']}, 4-1 in ${dist['4-1']}, 3-2 in ${dist['3-2']} debates (unanimity ${pct(dist['5-0'] / Math.max(1, n))}). High unanimity means the five blank listeners behave close to one judge.`);
  L.push('');
  L.push('## Head-to-head vote share (row type against column type)');
  L.push('');
  L.push(`| | ${ids.map((i) => i.replace('-', '<br>')).join(' | ')} |`);
  L.push(`|---|${ids.map(() => '---').join('|')}|`);
  for (const a of ids) {
    L.push(`| **${a}** | ${ids.map((b) => (a === b ? '·' : H[a]?.[b] ? `${Math.round((100 * H[a][b].for) / H[a][b].all)}<sub>${H[a][b].n}</sub>` : '')).join(' | ')} |`);
  }
  L.push('');
  if (en) {
    L.push('## Energy (measured)');
    L.push('');
    L.push(`- Logged ${en.hours.toFixed(2)} h of GPU telemetry: **${(en.gpuWh / 1000).toFixed(3)} kWh** on the GPU (mean ${en.gpuAvgW.toFixed(0)} W, peak ${en.gpuPeakW.toFixed(0)} W, mean utilisation ${en.gpuAvgUtil.toFixed(0)}%, max ${en.maxTemp} °C).`);
    L.push(`- Per debate: ${(en.gpuWh / Math.max(1, ALL_N)).toFixed(1)} Wh GPU (whole run, ${ALL_N} debates).`);
    L.push(`- CPU utilisation averaged ${en.cpuAvgUtil?.toFixed(0)}% (measured). Whole-system power was not metered; see METHOD.md for the estimate and the cost formula.`);
    L.push('');
  }
  const extras = rows.filter((r) => r.profiles || r.listenerModel !== 'qwen3.5:9b' || r.debaterModel !== 'qwen3.5:9b');
  if (extras.length) L.push(`Note: ${extras.length} debates used other models or listener profiles and are reported separately (run with --filter <model>).`);
  writeFileSync(F(`${OUT}.md`), L.join('\n'));
  writeFileSync(F(`${OUT}.json`), JSON.stringify({ n, votes: comps.length, firstShare, bt, btCI, fac, facCI, typeTable: tt, h2h: H, byScStyle, byScIdeo, dynamics: dyn, dist, energy: en }, null, 1));
  console.log(L.join('\n'));
}

build();
