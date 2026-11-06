/**
 * Overnight study runner.
 *
 *   node study/run.mjs --run <name> [--stop-at 06:00] [--start-at HH:MM]
 *
 * Everything lives in study/runs/<name>/:
 *   control.json     knobs the monitoring agent may edit while the run is live
 *                    (stopAt, pause, exclude types, models, rounds, maxPasses);
 *                    re-read before every debate
 *   schedule.json    the ordered debate list; also re-read when it changes, so the
 *                    monitor can append extra phases (e.g. a model comparison)
 *   results.jsonl    one compact row per finished debate (analysis input)
 *   debates/*.json   full record per debate (transcript, every listener memory, calls)
 *   transcripts/*.md the same, readable
 *   power.csv        nvidia-smi every 5 s (GPU watts, util, VRAM, temp)
 *   cpu.csv          whole-machine CPU utilisation every 5 s
 *   events.log       what the runner did, with timestamps
 *   status.json      progress + ETA, rewritten after every debate
 *
 * The schedule is a round-robin of all 66 type pairs, repeated in 3 passes. Each
 * pass is complete before the next starts, so stopping early still leaves an equal
 * number of debates per pair. Within a pair the first speaker is counterbalanced
 * and each repetition uses a different scenario.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, statSync, createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TYPES } from './archetypes.mjs';
import { SCENARIOS } from './scenarios.mjs';
import { runDebate, toMarkdown, rng } from './debate.mjs';
import { health } from './ollama.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const RUN = arg('run', `run-${new Date().toISOString().slice(0, 10)}`);
const DIR = path.join(HERE, 'runs', RUN);
for (const d of ['', 'debates', 'transcripts']) mkdirSync(path.join(DIR, d), { recursive: true });
const F = (n) => path.join(DIR, n);

const now = () => new Date();
const stamp = () => now().toISOString();
function event(msg) {
  const line = `${stamp()} ${msg}`;
  console.log(line);
  appendFileSync(F('events.log'), `${line}\n`);
}

// ------------------------------------------------------------ control + schedule

const DEFAULT_CONTROL = {
  stopAt: arg('stop-at', '06:00'),
  startAt: arg('start-at', null),
  pause: false,
  exclude: [],
  maxPasses: 3,
  rounds: 3,
  listeners: 5,
  debaterModel: 'qwen3.5:9b',
  listenerModel: 'qwen3.5:9b',
  debaterTemperature: 0.8,
  listenerTemperature: 0.8,
  listenerProfiles: null,
  note: 'Edited by the monitoring agent; every change is also logged in monitor-log.md.',
};

function readControl() {
  if (!existsSync(F('control.json'))) writeFileSync(F('control.json'), JSON.stringify(DEFAULT_CONTROL, null, 2));
  // strip a byte-order mark: PowerShell 5.1 Set-Content writes one, and JSON.parse rejects it
  try { return { ...DEFAULT_CONTROL, ...JSON.parse(readFileSync(F('control.json'), 'utf8').replace(/^﻿/, '')) }; }
  catch (e) { event(`control.json unreadable (${e.message}); keeping defaults`); return DEFAULT_CONTROL; }
}

export function buildSchedule(seed = 20261105) {
  const pairs = [];
  for (let i = 0; i < TYPES.length; i++) for (let j = i + 1; j < TYPES.length; j++) pairs.push([TYPES[i].id, TYPES[j].id]);
  const r = rng(seed);
  const out = [];
  for (let pass = 1; pass <= 3; pass++) {
    const batch = pairs.map(([x, y], p) => {
      // who speaks first: alternate by pair in pass 1, flip in pass 2, coin flip in pass 3
      const xFirst = pass === 1 ? p % 2 === 0 : pass === 2 ? p % 2 === 1 : r() < 0.5;
      const [typeA, typeB] = xFirst ? [x, y] : [y, x];
      // a different scenario in each pass for the same pair
      const sc = SCENARIOS[(p + pass - 1) % SCENARIOS.length].id;
      return { id: `p${pass}-${String(p).padStart(2, '0')}-${typeA}-vs-${typeB}-${sc}`, pass, pairIndex: p, scenarioId: sc, typeA, typeB, seed: Math.floor(r() * 1e6) };
    });
    for (let k = batch.length - 1; k > 0; k--) { const m = Math.floor(r() * (k + 1)); [batch[k], batch[m]] = [batch[m], batch[k]]; }
    out.push(...batch);
  }
  return out;
}

let scheduleCache = { mtime: 0, list: [] };
function readSchedule() {
  if (!existsSync(F('schedule.json'))) writeFileSync(F('schedule.json'), JSON.stringify(buildSchedule(), null, 1));
  const m = statSync(F('schedule.json')).mtimeMs;
  if (m !== scheduleCache.mtime) {
    scheduleCache = { mtime: m, list: JSON.parse(readFileSync(F('schedule.json'), 'utf8')) };
    event(`schedule loaded: ${scheduleCache.list.length} debates`);
  }
  return scheduleCache.list;
}

function doneIds() {
  if (!existsSync(F('results.jsonl'))) return new Set();
  return new Set(readFileSync(F('results.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).id));
}

/** "06:00" → the next Date with that wall-clock time (today if still ahead, else tomorrow). */
function nextClock(hhmm, ref = now()) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  if (d <= ref) d.setDate(d.getDate() + 1);
  return d;
}

// ------------------------------------------------------------ power + cpu logging

function startPowerLog() {
  if (!existsSync(F('power.csv'))) writeFileSync(F('power.csv'), 'timestamp,power_w,gpu_util_pct,vram_mib,temp_c\n');
  const out = createWriteStream(F('power.csv'), { flags: 'a' });
  const p = spawn('nvidia-smi', ['--query-gpu=timestamp,power.draw,utilization.gpu,memory.used,temperature.gpu', '--format=csv,noheader,nounits', '-l', '5'], { windowsHide: true });
  p.stdout.pipe(out);
  p.on('error', (e) => event(`nvidia-smi failed: ${e.message}`));
  if (!existsSync(F('cpu.csv'))) writeFileSync(F('cpu.csv'), 'timestamp,cpu_util_pct\n');
  let prev = os.cpus().map((c) => c.times);
  const t = setInterval(() => {
    const cur = os.cpus().map((c) => c.times);
    let idle = 0; let total = 0;
    cur.forEach((c, i) => {
      const p0 = prev[i];
      const tot = (c.user - p0.user) + (c.nice - p0.nice) + (c.sys - p0.sys) + (c.irq - p0.irq) + (c.idle - p0.idle);
      idle += c.idle - p0.idle; total += tot;
    });
    prev = cur;
    appendFileSync(F('cpu.csv'), `${stamp()},${total ? (100 * (1 - idle / total)).toFixed(1) : 0}\n`);
  }, 5000);
  return () => { clearInterval(t); p.kill(); };
}

// ------------------------------------------------------------ main loop

function compactRow(rec, cfg) {
  return {
    id: rec.id, pass: rec.pass, pairIndex: rec.pairIndex, scenario: rec.scenario, scenarioVersion: rec.scenarioVersion, protocol: rec.protocol, draftFirst: rec.draftFirst, domain: rec.domain, rounds: rec.rounds,
    typeA: rec.A.type, typeB: rec.B.type, styleA: rec.A.style, ideoA: rec.A.ideology, styleB: rec.B.style, ideoB: rec.B.ideology,
    nameA: rec.A.name, nameB: rec.B.name,
    votesA: rec.votes.A, votesB: rec.votes.B, winner: rec.winner, winnerType: rec.winnerType,
    leans: rec.roundTallies.map((t) => `${t.A}/${t.B}/${t.U}`),
    listenerFinal: rec.listeners.map((l) => l.memory[l.memory.length - 1].leanSide),
    listenerPath: rec.listeners.map((l) => l.memory.map((m) => m.leanSide).join('')),
    debaterModel: cfg.debaterModel, listenerModel: cfg.listenerModel, profiles: !!cfg.listenerProfiles,
    seconds: rec.seconds, tokensIn: rec.tokens.in, tokensOut: rec.tokens.out, retries: rec.tokens.retries,
    finishedAt: stamp(),
  };
}

function writeStatus(schedule, done, durations, ctl, stopAt, extra = {}) {
  const avg = durations.length ? durations.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, durations.length) : 120;
  const active = schedule.filter((s) => s.pass <= ctl.maxPasses && !ctl.exclude.includes(s.typeA) && !ctl.exclude.includes(s.typeB));
  const byPass = {};
  for (const s of active) {
    byPass[s.pass] ??= { total: 0, done: 0 };
    byPass[s.pass].total++;
    if (done.has(s.id)) byPass[s.pass].done++;
  }
  const remaining = active.filter((s) => !done.has(s.id)).length;
  const secsLeft = Math.max(0, (stopAt - now()) / 1000);
  const status = {
    run: RUN, updatedAt: stamp(), stopAt: stopAt.toISOString(),
    done: done.size, remaining, avgSecondsLast20: Math.round(avg),
    projectedFinishAll: new Date(Date.now() + remaining * avg * 1000).toISOString(),
    debatesThatFitBeforeStop: Math.floor(secsLeft / avg),
    byPass, exclude: ctl.exclude, ...extra,
  };
  writeFileSync(F('status.json'), JSON.stringify(status, null, 2));
  return status;
}

async function main() {
  let ctl = readControl();
  if (ctl.startAt) {
    const start = nextClock(ctl.startAt);
    event(`waiting until ${start.toLocaleString()} to start`);
    while (now() < start) await new Promise((r) => setTimeout(r, 15000));
  }
  const v = await health().catch(() => null);
  if (!v) { event('Ollama not reachable; aborting'); process.exit(1); }
  event(`run ${RUN} starting; ollama ${v}; pid ${process.pid}`);
  const stopPower = startPowerLog();
  const durations = [];
  const failures = {};
  let stopAt = nextClock(ctl.stopAt);
  event(`hard stop at ${stopAt.toLocaleString()}`);

  for (;;) {
    ctl = readControl();
    const newStop = nextClock(ctl.stopAt, new Date(Math.min(Date.now(), stopAt.getTime() - 1)));
    if (+newStop !== +stopAt) { stopAt = newStop; event(`stopAt changed to ${stopAt.toLocaleString()}`); }
    if (ctl.pause) { await new Promise((r) => setTimeout(r, 20000)); continue; }
    const schedule = readSchedule();
    const done = doneIds();
    const next = schedule.find((s) => s.pass <= ctl.maxPasses && !done.has(s.id)
      && !ctl.exclude.includes(s.typeA) && !ctl.exclude.includes(s.typeB) && (failures[s.id] || 0) < 2);
    const status = writeStatus(schedule, done, durations, ctl, stopAt);
    if (!next) { event('schedule exhausted'); break; }
    const avg = status.avgSecondsLast20;
    if (Date.now() + avg * 1000 > +stopAt) { event(`stopping: next debate (~${avg}s) would end after ${stopAt.toLocaleTimeString()}`); break; }

    const cfg = { ...ctl, ...(next.cfg || {}) };
    event(`start ${next.id} (${done.size + 1}/${status.done + status.remaining})`);
    try {
      const rec = await runDebate(next, cfg, (m) => event(m));
      writeFileSync(F(`debates/${rec.id}.json`), JSON.stringify(rec, null, 1));
      writeFileSync(F(`transcripts/${rec.id}.md`), toMarkdown(rec));
      appendFileSync(F('results.jsonl'), `${JSON.stringify(compactRow(rec, cfg))}\n`);
      durations.push(rec.seconds);
      event(`done  ${rec.id}: A ${rec.votes.A}-${rec.votes.B} B, winner ${rec.winnerType || 'tie'}, ${rec.seconds}s, retries ${rec.tokens.retries}`);
    } catch (e) {
      failures[next.id] = (failures[next.id] || 0) + 1;
      appendFileSync(F('errors.jsonl'), `${JSON.stringify({ at: stamp(), id: next.id, error: e.message })}\n`);
      event(`FAIL  ${next.id}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 10000));
    }
  }
  writeStatus(readSchedule(), doneIds(), durations, ctl, stopAt, { finished: true });
  stopPower();
  event('runner finished');
}

main().catch((e) => { event(`runner crashed: ${e.stack || e.message}`); process.exit(1); });
