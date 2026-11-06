// Builds one 1920x1080 HTML frame per segment, screenshots it with headless Chrome,
// and writes manifest.json with the waveform box for each segment.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const segs = JSON.parse(fs.readFileSync(path.join(dir, 'segments.json'), 'utf8'));
const only = process.argv.slice(2);
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const C = { bg: '#121117', panel: '#1b1a22', rule: '#2e2b38', ink: '#efebe3', muted: '#9c98a8',
  a: '#9a8ff0', b: '#e5a92e', u: '#5f5b6b', check: '#f0705f' };
const HEX = { narrator: 'c9c4d6', A: '9a8ff0', B: 'e5a92e', minister: 'efebe3' };

const P = {
  A: { name: 'Robin Castell', init: 'R', type: 'Technocrat · Realist', plan: 'Sign Saradan’s power deal: a 20-year contract in exchange for a slower fill.' },
  B: { name: 'Drew Halvorsen', init: 'D', type: 'Hybrid · Realist', plan: 'Halt grain exports to Saradan until it agrees to joint water management.' },
};
const ROUNDS = ['Opening statements', 'Rebuttals', 'Closing statements'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const css = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:${C.bg};color:${C.ink};
  font-family:'IBM Plex Sans Condensed',sans-serif}
.mono{font-family:'IBM Plex Mono',monospace}
.serif{font-family:'Newsreader',serif}
.top{position:absolute;left:80px;right:80px;top:56px;display:flex;justify-content:space-between;align-items:flex-start}
.kicker{font:500 22px 'IBM Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:${C.muted}}
.kicker b{color:${C.ink};font-weight:600}
.sub{font-size:26px;color:${C.muted};margin-top:8px}
.rounds{display:flex;gap:10px}
.rounds span{font:500 20px 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;padding:8px 14px;border:1px solid ${C.rule};border-radius:6px;color:${C.muted}}
.rounds span.on{color:${C.bg};background:${C.ink};border-color:${C.ink}}
.rounds span.done{color:${C.ink}}
.card{position:absolute;top:190px;width:440px;height:600px;padding:34px 34px;background:${C.panel};border:2px solid ${C.rule};border-radius:18px;transition:none}
.card.L{left:80px}.card.R{right:80px}
.card.dim{opacity:.38}
.av{width:116px;height:116px;border-radius:50%;display:grid;place-items:center;font:600 58px 'IBM Plex Sans Condensed';color:${C.bg}}
.nm{font-size:46px;font-weight:600;margin-top:26px;line-height:1.05}
.ty{font:500 22px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;margin-top:10px}
.pl{font-size:27px;line-height:1.3;color:${C.muted};margin-top:22px}
.side{font:500 20px 'IBM Plex Mono',monospace;letter-spacing:.12em;color:${C.muted};position:absolute;top:34px;right:34px}
.talk{position:absolute;left:34px;right:34px;bottom:30px;height:90px;border-top:1px solid ${C.rule}}
.center{position:absolute;left:580px;width:760px;top:190px;height:600px;display:flex;flex-direction:column;justify-content:center}
.q{font-family:'Newsreader',serif;font-size:48px;line-height:1.24;font-weight:400}
.q.big{font-size:60px;line-height:1.18;font-weight:500}
.qm{font-size:120px;line-height:.6;height:56px;font-family:'Newsreader',serif}
.att{font:500 22px 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};margin-top:30px}
.head{font-size:72px;font-weight:600;line-height:1.08;text-align:center;text-wrap:balance}
.seatsbar{position:absolute;left:80px;right:80px;top:850px;height:170px;border-top:1px solid ${C.rule};display:flex;align-items:center;justify-content:space-between}
.seats{display:flex;gap:34px;align-items:flex-end;position:absolute;left:50%;transform:translateX(-50%)}
.seat{display:flex;flex-direction:column;align-items:center;gap:10px;position:relative}
.dot{width:74px;height:74px;border-radius:50%;border:3px solid ${C.u};display:grid;place-items:center;font:600 30px 'IBM Plex Sans Condensed';color:${C.bg}}
.seat .lb{font:500 20px 'IBM Plex Mono',monospace;color:${C.muted}}
.seat .mv{position:absolute;top:-30px;font:600 17px 'IBM Plex Mono',monospace;letter-spacing:.08em;color:${C.b}}
.seat.ring .dot{box-shadow:0 0 0 6px ${C.bg},0 0 0 10px ${C.ink}}
.tally{font-size:38px;font-weight:500;text-align:right}
.tally small{display:block;font:500 20px 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:${C.muted};margin-bottom:8px}
.full{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;padding:0 160px}
.foot{position:absolute;left:80px;right:80px;bottom:56px;display:flex;justify-content:space-between;font:500 20px 'IBM Plex Mono',monospace;color:${C.muted};letter-spacing:.06em}
`;

const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=block" rel="stylesheet">`;

function top(round) {
  const pills = ROUNDS.map((r, i) => `<span class="${i + 1 === round ? 'on' : i + 1 < round ? 'done' : ''}">${r.split(' ')[0]}</span>`).join('');
  return `<div class="top"><div><div class="kicker"><b>The Tessel River</b> · Debate p3-41</div>
  <div class="sub">Merova’s cabinet decides how to answer Saradan’s dam</div></div>
  <div class="rounds">${pills}</div></div>`;
}
function card(side, active) {
  const p = P[side], col = side === 'A' ? C.a : C.b;
  return `<div class="card ${side === 'A' ? 'L' : 'R'} ${active ? '' : 'dim'}" style="${active ? `border-color:${col};box-shadow:0 0 60px ${col}33` : ''}">
  <div class="side">SIDE ${side}</div>
  <div class="av" style="background:${col}">${p.init}</div>
  <div class="nm">${p.name}</div><div class="ty" style="color:${col}">${p.type}</div>
  <div class="pl">${p.plan}</div><div class="talk"></div></div>`;
}
function seats(str, { final, ring, prev } = {}) {
  const n = { A: 0, B: 0, U: 0 };
  const dots = [...str].map((c, i) => {
    if (c !== '-') n[c]++;
    const fill = c === 'A' ? C.a : c === 'B' ? C.b : 'transparent';
    const bord = c === 'A' ? C.a : c === 'B' ? C.b : C.u;
    const moved = prev && prev[i] !== c ? `<div class="mv">MOVED</div>` : '';
    return `<div class="seat ${ring === i ? 'ring' : ''}">${moved}<div class="dot" style="background:${fill};border-color:${bord}">${c === 'A' ? 'R' : c === 'B' ? 'D' : ''}</div><div class="lb">L${i + 1}</div></div>`;
  }).join('');
  const t = str === '-----'
    ? `<small>Leaning</small><span style="color:${C.muted}">No views yet</span>`
    : `<small>${final ? 'Final vote' : 'Leaning'}</small><span style="color:${C.a}">Robin ${n.A}</span> &nbsp;·&nbsp; <span style="color:${C.b}">Drew ${n.B}</span>${n.U ? ` &nbsp;·&nbsp; <span style="color:${C.muted}">Undecided ${n.U}</span>` : ''}`;
  return `<div class="seatsbar"><div><div class="kicker">The cabinet</div><div class="sub">5 AI ministers · no built-in politics</div></div>
  <div class="seats">${dots}</div><div class="tally">${t}</div></div>`;
}

// Waveform boxes (ffmpeg overlay coordinates)
const WAVE = {
  A: { x: 116, y: 676, w: 368, h: 80 },
  B: { x: 1436, y: 676, w: 368, h: 80 },
  center: { x: 660, y: 740, w: 600, h: 70 },
  full: { x: 660, y: 900, w: 600, h: 70 },
};

const PREV = { s09: 'AAAUU' };
const manifest = [];
for (const s of segs) {
  let body = '', wave;
  if (s.kind === 'title') {
    body = `<div class="full" style="align-items:flex-start">
      <div class="kicker">Inside the debates · AI persuasion study</div>
      <div style="font-size:150px;font-weight:600;line-height:1;margin-top:28px">One closing line</div>
      <div class="serif" style="font-size:46px;color:${C.muted};margin-top:30px;max-width:1300px">Two AI envoys argue about a dam on the Tessel River.<br>Five AI ministers vote.</div>
      <div style="display:flex;gap:18px;margin-top:56px">
        <div class="av" style="background:${C.a};width:86px;height:86px;font-size:42px">R</div>
        <div class="av" style="background:${C.b};width:86px;height:86px;font-size:42px">D</div>
        <div style="display:flex;gap:10px;align-items:center;margin-left:24px">${'<div class="dot" style="width:46px;height:46px"></div>'.repeat(5)}</div>
      </div></div>
      <div class="foot"><span>Debate p3-41 · qwen3.5:9b, run locally</span><span>Envoy and minister lines: verbatim model output, excerpted · synthetic voices</span></div>`;
    wave = WAVE.full;
  } else if (s.kind === 'setup') {
    body = `${top(0)}${card('A', true)}${card('B', true)}
      <div class="center"><div class="serif" style="font-size:40px;line-height:1.3;color:${C.ink}">Saradan’s new dam will cut Merova’s river flow by 25% while it fills, and by 10% for good.</div>
      <div class="serif" style="font-size:40px;line-height:1.3;color:${C.muted};margin-top:28px">Two envoys propose different answers. Three rounds of speeches, then the cabinet votes.</div></div>
      ${seats('-----')}`;
    wave = WAVE.center;
  } else if (s.kind === 'speech') {
    const col = s.voice === 'A' ? C.a : C.b, who = P[s.voice].name.split(' ')[0];
    body = `${top(s.round)}${card('A', s.voice === 'A')}${card('B', s.voice === 'B')}
      <div class="center"><div class="qm" style="color:${col}">“</div><div class="q ${s.big ? 'big' : ''}">${esc(s.show)}</div>
      <div class="att">${who} · ${ROUNDS[s.round - 1].replace('statements', 'statement').toLowerCase()}${s.big ? ' · last speech of the debate' : ''}</div></div>
      ${seats(s.seats)}`;
    wave = WAVE[s.voice];
  } else if (s.kind === 'tally' || s.kind === 'beat') {
    const hl = s.kind === 'beat' ? 'B' : s.final ? 'B' : null;
    body = `${top(s.round)}${card('A', !hl)}${card('B', hl === 'B' || !hl)}
      <div class="center"><div class="head">${esc(s.headline)}</div></div>
      ${seats(s.seats, { final: s.final, prev: PREV[s.id] })}`;
    wave = WAVE.center;
  } else if (s.kind === 'minister') {
    body = `${top(s.round)}${card('A', false)}${card('B', false)}
      <div class="center"><div class="qm" style="color:${C.b}">“</div><div class="q">${esc(s.show)}</div>
      <div class="att">${esc(s.who)}</div></div>
      ${seats(s.seats, { final: true, ring: 1 })}`;
    wave = WAVE.center;
  } else if (s.kind === 'check') {
    body = `<div class="full">
      <div class="kicker" style="color:${C.check}">Fact check</div>
      <div style="font-size:72px;font-weight:600;line-height:1.08;margin-top:22px;max-width:1500px">The 10% loss happens with or without the contract.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:56px">
        <div style="border-left:5px solid ${C.check};padding-left:28px"><div class="kicker">The scenario brief</div>
          <div class="serif" style="font-size:36px;line-height:1.3;margin-top:14px">“…and 10% for good after that because of evaporation and Saradan’s planned irrigation.”</div></div>
        <div style="border-left:5px solid ${C.a};padding-left:28px"><div class="kicker">Robin, one speech earlier</div>
          <div class="serif" style="font-size:36px;line-height:1.3;margin-top:14px">“…the permanent ten percent flow loss they cause by evaporation and irrigation.”</div></div>
      </div>
      <div style="font-size:34px;color:${C.muted};margin-top:56px">Drew spoke last, so nobody could reply. Three ministers repeated the framing in their votes.</div></div>`;
    wave = WAVE.full;
  } else if (s.kind === 'end') {
    body = `<div class="full" style="align-items:center;text-align:center">
      <div class="kicker">AI persuasion study</div>
      <div style="font-size:96px;font-weight:600;line-height:1.05;margin-top:26px">1 of 198 debates</div>
      <div class="serif" style="font-size:42px;color:${C.muted};margin-top:30px">12 debater types · 4 scenarios · 5 AI listeners each<br>run overnight on a small local model</div></div>`;
    wave = WAVE.full;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8">${fonts}<style>${css}</style></head><body>${body}</body></html>`;
  const hp = path.join(dir, `${s.id}.html`);
  fs.writeFileSync(hp, html);
  manifest.push({ id: s.id, wave, color: HEX[s.voice] });
  if (only.length && !only.includes(s.id)) continue;
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    `--user-data-dir=${path.join(dir, 'chrome-prof')}`, '--window-size=1920,1080', '--virtual-time-budget=6000',
    `--screenshot=${path.join(dir, `${s.id}.png`)}`, pathToFileURL(hp).href], { stdio: 'ignore' });
  console.log('frame', s.id);
}
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
