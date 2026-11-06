import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const url = 'http://localhost:5180';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = path.join(process.env.TEMP || '.', 'chrome-ss-qa-' + Date.now());

const chromeProc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,900',
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank'
]);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  let endpoint = null;
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    try {
      const res = await fetch('http://127.0.0.1:9225/json/version');
      if (res.ok) { endpoint = true; break; }
    } catch (e) {}
  }
  if (!endpoint) throw new Error('Chrome did not respond');

  const newTargetRes = await fetch(`http://127.0.0.1:9225/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function take(fileName, waitMs = 500) {
    if (waitMs) await sleep(waitMs);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(shot.data, 'base64');
    fs.writeFileSync(fileName, buf);
    console.log(`Saved screenshot: ${fileName} (${buf.length} bytes)`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url });
  await sleep(1500);

  // 1. Start Screen
  await take('qa_start_screen.png', 1000);

  // 2. Open Trait Modal for first persona
  await send('Runtime.evaluate', {
    expression: `document.querySelectorAll('.cast-card')[0].click()`
  });
  await take('qa_traits_modal.png', 800);

  // Close trait modal
  await send('Runtime.evaluate', {
    expression: `document.querySelector('#btnDoneTraits')?.click()`
  });
  await sleep(500);

  // 3. Select 1900s Grand Boardroom and 1900s Titanic Scenario, then convene
  await send('Runtime.evaluate', {
    expression: `
      const th = document.querySelector('.theme-card[data-theme="boardroom1900"]');
      if (th) th.click();
      const sc = document.querySelector('.scn[data-id="titanic_1912"]');
      if (sc) sc.click();
      document.getElementById('btnConvene').click();
    `
  });
  await take('qa_boardroom_1900.png', 2800);

  // 4. Open Mind Inspector for Dr. Okafor
  await send('Runtime.evaluate', {
    expression: `
      const row = document.querySelector('.roster-row[data-id="okafor"]') || document.querySelector('.plate[data-id="okafor"]');
      if (row) row.click();
    `
  });
  await take('qa_mind_inspector.png', 1000);

  // 5. Call a Vote to test Aftermath Outcome Flow
  await send('Runtime.evaluate', {
    expression: `
      const lever = document.querySelector('.lever-vote');
      if (lever) lever.click();
    `
  });
  await sleep(600);
  // Select first motion preset and click call vote
  await send('Runtime.evaluate', {
    expression: `
      const preset = document.querySelector('#popover .preset');
      if (preset) preset.click();
      const sendBtn = document.querySelector('#popover [data-act="send"]');
      if (sendBtn) sendBtn.click();
    `
  });

  // Wait for ballots to finish casting and the result aftermath modal to open
  let modalFound = false;
  for (let i = 0; i < 40; i++) {
    await sleep(400);
    const evalRes = await send('Runtime.evaluate', {
      expression: `!document.getElementById('modal').classList.contains('is-hidden') && Boolean(document.querySelector('.aftermath-box'))`,
      returnByValue: true
    });
    if (evalRes?.result?.value) {
      modalFound = true;
      break;
    }
  }
  console.log('Aftermath modal open:', modalFound);
  await take('qa_vote_aftermath.png', 800);

  // 6. Click "Reassemble 5 Hours Later" under Total Failure
  await send('Runtime.evaluate', {
    expression: `
      const totalFailRadio = document.querySelector('input[name="aftermathOpt"][value="total_failure"]');
      if (totalFailRadio) {
        totalFailRadio.checked = true;
        totalFailRadio.dispatchEvent(new Event('change', { bubbles: true }));
      }
      const re = document.querySelector('[data-act="reassemble"]');
      if (re) re.click();
    `
  });
  await take('qa_reassemble_5hrs.png', 800);

  ws.close();
  try { await fetch(`http://127.0.0.1:9225/json/close/${target.id}`); } catch (e) {}
  chromeProc.kill();
}

run().catch(err => {
  console.error(err);
  try { chromeProc.kill(); } catch (e) {}
  process.exit(1);
});
