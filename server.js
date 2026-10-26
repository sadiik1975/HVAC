// Zero-dependency server: node --env-file=.env server.js
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Flow = require('./public/flow.js');

const PORT = Number(process.env.PORT || 3100);
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

const hits = new Map();
const limited = (key, max, windowMs) => {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
};
setInterval(() => hits.clear(), 3600e3).unref();

// Ids already delivered, so a retried request never produces a second alert.
const delivered = new Set();

const clientIp = (req) =>
  (process.env.TRUST_PROXY === '1' && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};
const readBody = (req) => new Promise((resolve, reject) => {
  let size = 0; const chunks = [];
  req.on('data', (c) => { size += c.length; if (size > 20000) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
  req.on('error', reject);
});

// Returns a sanitized lead or null when the payload is not a complete booking.
function validateLead(b) {
  const urgent = b.urgent === true;
  const phone = Flow.normalizePhone(b.phone);
  const job = clean(b.job, 60);
  const lead = {
    id: clean(b.id, 64), name: clean(b.name, 100), phone, job,
    detail: urgent ? '' : clean(b.detail, 200), urgent,
    day: clean(b.day, 20), time: clean(b.time, 20),
  };
  if (!lead.id || lead.name.length < 2 || !phone || !job) return null;
  if (!urgent) {
    if (!Flow.DAYS.some((d) => d.value === lead.day)) return null;
    if (!Flow.TIMES.some((t) => t.value === lead.time)) return null;
    if (!lead.detail) return null;
  }
  return lead;
}

async function sendTelegram(text) {
  const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT, text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Telegram HTTP ${r.status}`);
}

const SEC = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' };
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/flow.js': ['flow.js', 'application/javascript; charset=utf-8'],
  '/bootstrap.min.css': ['bootstrap.min.css', 'text/css; charset=utf-8'],
};
const sendFile = (res, file, type) => {
  fs.readFile(path.join(__dirname, 'public', file), (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': type, ...SEC });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  try {
    if (req.method === 'GET' && FILES[p]) return sendFile(res, ...FILES[p]);
    if (req.method === 'GET' && p === '/healthz') return json(res, 200, { ok: true });

    if (req.method === 'POST' && p === '/api/leads') {
      if (limited('lead:' + clientIp(req), 30, 3600e3)) return json(res, 429, { error: 'Too many submissions' });
      const lead = validateLead(await readBody(req));
      if (!lead) return json(res, 400, { error: 'Invalid input' });
      if (delivered.has(lead.id)) return json(res, 200, { ok: true, duplicate: true });
      if (!TG_TOKEN || !TG_CHAT) return json(res, 503, { error: 'Alerts are not configured' });
      try {
        await sendTelegram(Flow.formatAlert(lead));
      } catch (e) {
        console.error('Telegram failed:', e.message);
        return json(res, 502, { error: 'Alert delivery failed' });
      }
      delivered.add(lead.id);
      return json(res, 201, { ok: true });
    }
    res.writeHead(404, SEC); res.end('Not found');
  } catch (e) {
    console.error(e.message);
    json(res, 400, { error: 'Bad request' });
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`Borough Build HVAC demo on http://localhost:${PORT}`));
}
module.exports = { validateLead, server };
