// Renders the README's screenshots, docs/images/screenshot-light.png and screenshot-dark.png, from
// src/ in headless Edge or Chrome: the ii–V–I in C with a voice-led path pinned in the middle of
// the neck, and two progressions under My presets. Run from the repo root after a visible UI change:
//   node scripts/screenshots.mjs
// Needs Node 22+ (or Node 21 with --experimental-websocket). Set BROWSER to the browser's path if
// it isn't found.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const WIDTH = 1280;
const HEIGHT = 820;
const SERVE_PORT = 5179;
const DEBUG_PORT = 9339;
// A chord as app.js keeps it; letter is an index into C D E F G A B.
const chord = (letter, acc, quality, role) => ({ root: { letter, acc }, quality, role });
const STATE = {
  leading: true,
  anchor: 1,
  pins: { 1: 'drop2.4321.10-10-10-10' },
  saved: [
    { id: 1, name: 'Rhythm changes, A', chords: [chord(6, -1, 'maj7', 'I'), chord(4, 0, 'dom7', 'VI'), chord(0, 0, 'm7', 'ii'), chord(3, 0, 'dom7', 'V')] },
    { id: 2, name: 'Minor blues in C', chords: [chord(0, 0, 'm6', 'i'), chord(3, 0, 'm7', 'iv'), chord(0, 0, 'm6', 'i'), chord(1, 0, 'm7b5', 'iiø'), chord(4, 0, 'dom7', 'V'), chord(0, 0, 'm6', 'i')] },
  ],
};

if (typeof WebSocket === 'undefined') {
  console.error('This needs Node 22 or newer, or: node --experimental-websocket scripts/screenshots.mjs');
  process.exit(1);
}

const browserPath = [
  process.env.BROWSER,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].find((path) => path && existsSync(path));
if (!browserPath) {
  console.error('No Edge or Chrome found. Set BROWSER to its path.');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Not up yet.
    }
    await sleep(250);
  }
  throw new Error(`Nothing answered at ${url}`);
}

const server = spawn(process.execPath, ['scripts/serve.mjs', String(SERVE_PORT)], { stdio: 'ignore' });
const profile = mkdtempSync(join(tmpdir(), 'jazz-guitar-helper-shots-'));
const browser = spawn(browserPath, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

try {
  await waitFor(`http://127.0.0.1:${SERVE_PORT}/`);
  const targets = await (await waitFor(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  let nextId = 0;
  const waiting = new Map();
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    waiting.get(message.id)?.(message);
    waiting.delete(message.id);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, (message) => (message.error ? reject(new Error(message.error.message)) : resolve(message.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: `http://127.0.0.1:${SERVE_PORT}/` });
  await sleep(800);
  // The default state with the path pinned; app.js fills in the other chords' pins.
  await send('Runtime.evaluate', {
    expression: `localStorage.clear(); localStorage.setItem('jazz-guitar-helper.ui', ${JSON.stringify(JSON.stringify(STATE))});`,
  });
  mkdirSync('docs/images', { recursive: true });
  for (const theme of ['light', 'dark']) {
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
    await send('Page.reload');
    await sleep(1200);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(`docs/images/screenshot-${theme}.png`, Buffer.from(data, 'base64'));
    console.log(`docs/images/screenshot-${theme}.png`);
  }
  socket.close();
} finally {
  browser.kill();
  server.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
