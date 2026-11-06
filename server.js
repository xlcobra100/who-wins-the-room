/**
 * Production server: serves the built game from ./dist and mounts the same
 * /api middleware the dev server uses. Run `npm run build` first (or `npm run serve`).
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiMiddleware } from './server/api.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT || 4180);
const api = createApiMiddleware();
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = normalize(join(root, urlPath));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end('Forbidden'); }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html'); // SPA fallback
  }
  try {
    const data = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end('Not found — did you run `npm run build`?');
  }
}

http.createServer((req, res) => api(req, res, () => serveStatic(req, res))).listen(port, () => {
  console.log(`\n  Halcyon Council is in session:  http://localhost:${port}\n`);
});
