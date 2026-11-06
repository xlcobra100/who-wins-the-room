// Turns frames (sNN.png) + voice lines (sNN.wav) into one MP4 with a live waveform under each speaker.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
const out = process.argv[2] || path.join(dir, 'debate-clip.mp4');
const man = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
const LEAD = 0.35, TAIL = 0.6, T = 0.3, FPS = 30;
const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const probe = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

const durs = [];
for (const m of man) {
  const png = path.join(dir, `${m.id}.png`), wav = path.join(dir, `${m.id}.wav`);
  const dur = +(LEAD + probe(wav) + TAIL).toFixed(3);
  durs.push(dur);
  const w = m.wave;
  const fc = `[1:a]adelay=delays=${LEAD * 1000}:all=1,apad=whole_dur=${dur},asplit[a][wa];` +
    `[wa]showwaves=s=${w.w}x${w.h}:mode=cline:colors=0x${m.color}:rate=${FPS}:scale=sqrt:draw=full[wv];` +
    `[0:v][wv]overlay=${w.x}:${w.y}:eof_action=pass,format=yuv420p[v]`;
  ff(['-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', png, '-i', wav,
    '-filter_complex', fc, '-map', '[v]', '-map', '[a]', '-t', String(dur),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-r', String(FPS),
    '-c:a', 'pcm_s16le', '-ar', '48000', path.join(dir, `seg_${m.id}.mkv`)]);
  console.log(m.id, dur);
}

// Chain crossfades: video xfade + audio acrossfade with the same overlap keep sync.
const inputs = man.flatMap((m) => ['-i', path.join(dir, `seg_${m.id}.mkv`)]);
let fc = '', v = '[0:v]', a = '[0:a]', off = 0;
for (let i = 1; i < man.length; i++) {
  off += durs[i - 1] - T;
  fc += `${v}[${i}:v]xfade=transition=fade:duration=${T}:offset=${off.toFixed(3)}[v${i}];`;
  fc += `${a}[${i}:a]acrossfade=d=${T}[a${i}];`;
  v = `[v${i}]`; a = `[a${i}]`;
}
const total = durs.reduce((s, d) => s + d, 0) - T * (man.length - 1);
fc += `${v}fade=t=in:st=0:d=0.5,fade=t=out:st=${(total - 0.6).toFixed(3)}:d=0.6,format=yuv420p[vo];`;
fc += `${a}loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[ao]`;
ff([...inputs, '-filter_complex', fc, '-map', '[vo]', '-map', '[ao]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
console.log('total', total.toFixed(2), 's ->', out);
