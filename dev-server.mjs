import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { publicConfig } from './config.mjs';
import { realtimeBundle } from './bundle.mjs';
const sdk = await realtimeBundle();
const root = new URL('./public/', import.meta.url);
const types = { '/': ['index.html', 'text/html; charset=utf-8'], '/index.html': ['index.html', 'text/html; charset=utf-8'], '/style.css': ['style.css', 'text/css; charset=utf-8'], '/app.mjs': ['app.mjs', 'text/javascript; charset=utf-8'], '/core.mjs': ['core.mjs', 'text/javascript; charset=utf-8'], '/realtime.mjs': ['realtime.mjs', 'text/javascript; charset=utf-8'], '/service.mjs': ['service.mjs', 'text/javascript; charset=utf-8'], '/render.mjs': ['render.mjs', 'text/javascript; charset=utf-8'], '/examples/base.ipynb': ['examples/base.ipynb', 'application/json'], '/examples/revision.ipynb': ['examples/revision.ipynb', 'application/json'] };
const config = publicConfig();
const connect = config.configured ? config.url + ' ' + config.url.replace('https:', 'wss:') : '';
createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' " + connect + "; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }
  if (pathname === '/api/config' || pathname === '/config.json') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(config)); return; }
  if (pathname === '/realtime-sdk.mjs') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(sdk); return; }
  const entry = types[pathname];
  if (!entry) { res.writeHead(404); res.end('Not found'); return; }
  try { const content = await readFile(new URL(entry[0], root)); res.setHeader('Content-Type', entry[1]); res.end(content); } catch { res.writeHead(500); res.end('Unable to read application asset'); }
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log('Notebook Review: http://127.0.0.1:' + (process.env.PORT || 4173)));
