'use strict';
// crash reporting first, so Sentry is set up before anything else loads (lib/crash.js)
const crash = require('./lib/crash');
// One plain Node server, made from isleofdan/starting-kit.
//   /login (GET, POST), /logout, /app.css, /alive,
//   /alive/guns (where the rifle set came from)    — open
//   /manifest.webmanifest, /sw.js, /install.js,
//   /icon-192.png, /icon-512.png                   — open (installing on the phone)
//   /sentry.min.js, /crash.js                      — open (crash reporting, also on the sign-in page)
//   everything else (/, /status, an app's own)     — behind the passphrase cookie
// Fail closed: with APP_PASSWORD or COOKIE_SECRET unset, only the sign-in
// page serves, and it says the server is not configured.

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');

const app = require('./lib/app');
const auth = require('./lib/auth');
const upstream = require('./lib/upstream');
const ratelimit = require('./lib/ratelimit');
const { execFileSync } = require('node:child_process');
const { sendJson, sendHtml, sendText, redirect, readJson, serveStatic, escapeHtml } = require('./lib/http');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, 'public');
const { APP_PASSWORD, COOKIE_SECRET } = process.env;
const SECURE_COOKIE = process.env.COOKIE_INSECURE !== '1';
const CONFIGURED = Boolean(APP_PASSWORD && COOKIE_SECRET);

if (!CONFIGURED) {
  const missing = ['APP_PASSWORD', 'COOKIE_SECRET'].filter((k) => !process.env[k]);
  console.error(`not configured: ${missing.join(', ')} unset. Only the sign-in page will serve.`);
}

// When this copy started and which commit it runs. The deploy passes COMMIT;
// on a computer it is read from git, if there is one.
const STARTED = new Date();
const COMMIT = (process.env.COMMIT || (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { return ''; }
})()).trim().slice(0, 7) || 'unknown';
const aliveLine = () => `alive since ${STARTED.toISOString().replace(/\.\d+Z$/, 'Z')} · ${COMMIT}`;

const NOT_CONFIGURED = 'The server is not set up yet: APP_PASSWORD or COOKIE_SECRET is missing.';

// A page from public/, with {{KEY}} filled in (escaped) from `values`.
const templates = {};
function page(file, values = {}) {
  templates[file] ??= fs.readFileSync(path.join(PUBLIC, file), 'utf8');
  const all = { TITLE: app.title, ...values };
  return templates[file].replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in all ? escapeHtml(all[k]) : m));
}

// Only a path on this site: never another host.
function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)/.test(next) && !next.startsWith('/login') ? next : '/';
}

function loginPage(res, status, message = '', next = '/') {
  sendHtml(res, status, page('login.html', { MESSAGE: message, NEXT: safeNext(next) }));
}

function wantsJson(req) {
  return (req.headers.accept || '').includes('application/json')
    || (req.headers['content-type'] || '').includes('application/json');
}

async function handleLogin(req, res) {
  if (!CONFIGURED) {
    return wantsJson(req) ? sendJson(res, 503, { error: NOT_CONFIGURED }) : loginPage(res, 503, NOT_CONFIGURED);
  }
  const wait = ratelimit.lockedFor(req);
  if (wait > 0) {
    const msg = `Too many wrong passphrases. Wait about ${Math.ceil(wait / 60)} minutes, then try again.`;
    return wantsJson(req) ? sendJson(res, 429, { error: msg, retry_after_s: wait }, { 'retry-after': String(wait) })
      : loginPage(res, 429, msg);
  }
  let body;
  try { body = await readJson(req); } catch (e) { return sendJson(res, e.status || 400, { error: e.message }); }
  if (!auth.passwordOk(body.passphrase, APP_PASSWORD)) {
    ratelimit.recordFailure(req);
    const msg = 'That passphrase is not right. Try again.';
    return wantsJson(req) ? sendJson(res, 401, { error: msg }) : loginPage(res, 401, msg, body.next);
  }
  ratelimit.clear(req);
  const headers = { 'set-cookie': auth.issueCookie(COOKIE_SECRET, { secure: SECURE_COOKIE }) };
  return wantsJson(req) ? sendJson(res, 200, { ok: true }, headers) : redirect(res, safeNext(body.next), headers);
}

// --- routes behind the cookie -----------------------------------------------
// An app adds its own screens and /api/ routes here.

const routes = [];
function route(method, pattern, run) { routes.push({ method, pattern, run }); }

route('GET', /^\/$/, (req, res) => sendHtml(res, 200, page('index.html')));

// Range Day's screens and data. The game's data (data/*.json) is checked
// at startup: a figure without a source or an estimate stops the server.
const gameData = require('./lib/data').load();
if (gameData.problems.length) {
  throw new Error('data/: ' + gameData.problems.join('; '));
}
// The rifle set comes from gun records (lib/guns.js). range-day-fifteen: with
// SPINE_GUNS_URL set (fly.toml), from Dan's gun records in the Spine, read
// before the server listens and every 10 minutes after, falling back to the
// last set accepted from the Spine, or to data/rifles.json when there is none
// yet (lib/spine-guns.js); /alive/guns says which. With GUN_RECORDS_FILE set
// (tests, local runs), from that file; a bad record there stops the server
// with its name and the fault. With neither, from data/rifles.json.
let spineGuns = null;
if (process.env.GUN_RECORDS_FILE || !process.env.SPINE_GUNS_URL) {
  const guns = require('./lib/guns').load(gameData.raw);
  gameData.flat.rifles = guns.rifles;
  console.log(`rifles: ${Object.keys(guns.rifles).length} from ${guns.from}`);
}
if (!process.env.GUN_RECORDS_FILE) {
  spineGuns = require('./lib/spine-guns').reader({
    url: process.env.SPINE_GUNS_URL || '',
    raw: gameData.raw,
    onSet: (rifles) => { gameData.flat.rifles = rifles; },
    everyMs: Number(process.env.SPINE_GUNS_EVERY_MS) || undefined,
  });
}
const gunsLine = () => (spineGuns ? spineGuns.line() : `guns from ${process.env.GUN_RECORDS_FILE} (GUN_RECORDS_FILE): the Spine is not read`);
route('GET', /^\/zero$/, (req, res) => sendHtml(res, 200, page('zero.html')));
route('GET', /^\/line$/, (req, res) => sendHtml(res, 200, page('line.html')));
route('GET', /^\/day$/, (req, res) => sendHtml(res, 200, page('day.html')));
// range-day-fourteen: a day played back through the spotting scope: the firing line's own page and drawing, read-only (public/line.js, PLAYBACK).
route('GET', /^\/playback$/, (req, res) => sendHtml(res, 200, page('line.html')));
route('GET', /^\/book$/, (req, res) => sendHtml(res, 200, page('book.html')));
route('GET', /^\/api\/data$/, (req, res) => sendJson(res, 200, gameData.flat));
// The page scripts, behind the cookie like the screens that use them.
route('GET', /^\/(engine|game|home|zero|line|day|book)\.js$/, (req, res, m) => { if (!serveStatic(res, PUBLIC, `/${m[1]}.js`)) sendJson(res, 404, { error: 'not found' }); });
// The firing line's 3D picture (public/scene.min.js, built by scripts/build-scene.mjs) and the surveyed ground it stands on
// (public/terrain/, fetched by the Terrain workflow): each terrain file is named with its content hash, so a browser may keep
// it for a year and a second visit downloads none of it. Both behind the cookie like the screens.
route('GET', /^\/scene\.min\.js$/, (req, res) => { if (!serveStatic(res, PUBLIC, '/scene.min.js')) sendJson(res, 404, { error: 'not found' }); });
route('GET', /^\/terrain\/([a-z0-9-]+-[0-9a-f]{8}\.(png|jpg))$/, (req, res, m) => { if (!serveStatic(res, PUBLIC, `/terrain/${m[1]}`, { 'cache-control': 'public, max-age=31536000, immutable' })) sendJson(res, 404, { error: 'not found' }); });

route('GET', /^\/status$/, (req, res) => {
  const { calls, lastError: e } = upstream.state();
  const headline = e ? `${e.service} answered ${e.status ?? 'nothing'} at ${e.at.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`
    : calls ? `Nothing failed (${calls} calls so far).` : 'Nothing called yet.';
  sendHtml(res, 200, page('status.html', { ALIVE: aliveLine(), UPSTREAM_HEADLINE: headline, UPSTREAM_DETAIL: e ? e.message : '' }));
});

// The check that crash reporting works: an unexpected error, reported by the
// catch at the bottom like any other, answered 500. The deploy's "Check a
// crash reaches Sentry" step calls it; Sentry files its Wall card through
// the Spine.
route('POST', /^\/crash-test$/, () => {
  throw new Error('crash-test: this app reports crashes');
});

// --- the server -------------------------------------------------------------

// Installable on the phone by default (Dan, 23 Oct 2026: every web app
// installs as a Chrome phone app unless there is a reason it shouldn't).
// Chrome fetches the manifest and the icons without the cookie, and none of
// these files holds anything of Dan's, so they are open like the stylesheet.
// So is crash reporting's pair, which the sign-in page loads too.
const OPEN_FILES = new Set(['/app.css', '/sw.js', '/install.js', '/icon-192.png', '/icon-512.png', '/sentry.min.js', '/crash.js']);

// The manifest, named from app.json like everything else.
function manifest() {
  return {
    id: '/',
    name: app.title,
    short_name: app.title.length > 12 ? app.title.slice(0, 12).trimEnd() : app.title,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafaf8',
    theme_color: '#8c3b1e',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
}

async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p === '/alive') return sendText(res, 200, aliveLine() + '\n');
  if (p === '/alive/guns') return sendText(res, 200, gunsLine() + '\n');
  if (p === '/login' && req.method === 'GET') return loginPage(res, CONFIGURED ? 200 : 503, CONFIGURED ? '' : NOT_CONFIGURED, url.searchParams.get('next'));
  if (p === '/login' && req.method === 'POST') return handleLogin(req, res);
  if (p === '/logout') return redirect(res, '/login', { 'set-cookie': auth.clearCookie({ secure: SECURE_COOKIE }) });
  if (req.method === 'GET' && p === '/manifest.webmanifest') return sendJson(res, 200, manifest(), { 'content-type': 'application/manifest+json; charset=utf-8' });
  if (req.method === 'GET' && OPEN_FILES.has(p) && serveStatic(res, PUBLIC, p)) return;

  if (!CONFIGURED || !auth.cookieOk(req, COOKIE_SECRET)) {
    if (p.startsWith('/api/') || wantsJson(req)) return sendJson(res, 401, { error: 'sign in first' });
    return redirect(res, `/login?next=${encodeURIComponent(p + url.search)}`);
  }

  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(p);
    if (m) return r.run(req, res, m);
  }
  return sendJson(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    const status = e.status || 500;
    if (status >= 500) {
      console.error(e.stack || e.message);
      crash.captureException(e);
    }
    if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? 'something went wrong on the server' : e.message });
    else res.end();
  });
});

// The rifle set first (the Spine's read waits at most its 5-second limit), then listen.
(spineGuns ? spineGuns.start() : Promise.resolve()).then(() => {
  if (spineGuns) { console.log(spineGuns.line()); spineGuns.every(); }
  server.listen(PORT, () => console.log(`${app.name} on ${PORT}`));
}).catch((e) => { console.error(e.stack || e.message); process.exit(1); });

// On stop (Fly sends SIGINT, then kills after 5 s): send what was captured,
// then close. A connection still open after 2 s more does not hold it up.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, async () => {
    await crash.flush(2000);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

module.exports = server;
