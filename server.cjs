'use strict';

require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const PRINT_SERVICE_URL = process.env.PRINT_SERVICE_URL || 'http://localhost:8080';
const PRINT_SERVICE_KEY = process.env.PRINT_SERVICE_KEY || '';

async function printdFetch(pathname, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (PRINT_SERVICE_KEY) headers['Authorization'] = `Bearer ${PRINT_SERVICE_KEY}`;
  const r = await fetch(`${PRINT_SERVICE_URL}${pathname}`, { ...init, headers });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { error: text };
  }
  return { ok: r.ok, status: r.status, body };
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── SQLite setup ──────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, 'data', 'todo.db');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL,
    planned_seconds INTEGER NOT NULL,
    was_abandoned INTEGER NOT NULL DEFAULT 0,
    tags TEXT NOT NULL DEFAULT '[]',
    rating INTEGER
  );
  CREATE TABLE IF NOT EXISTS day_log (
    date TEXT PRIMARY KEY,
    started_at INTEGER NOT NULL,
    ended_at INTEGER
  );
`);

// ── Session routes ────────────────────────────────────────────────────────────

function rowToSession(r) {
  return {
    id: r.id,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationSeconds: r.duration_seconds,
    plannedSeconds: r.planned_seconds,
    wasAbandoned: r.was_abandoned === 1,
    tags: JSON.parse(r.tags || '[]'),
    rating: r.rating ?? null,
  };
}

app.get('/api/sessions', (_req, res) => {
  res.json(db.prepare('SELECT * FROM sessions ORDER BY started_at DESC').all().map(rowToSession));
});

app.post('/api/sessions', (req, res) => {
  const s = req.body;
  if (!s.id || !s.startedAt) return res.status(400).json({ error: 'invalid session' });
  db.prepare(
    `
    INSERT INTO sessions (id, started_at, ended_at, duration_seconds, planned_seconds, was_abandoned, tags, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    s.id,
    s.startedAt,
    s.endedAt,
    s.durationSeconds,
    s.plannedSeconds,
    s.wasAbandoned ? 1 : 0,
    JSON.stringify(s.tags ?? []),
    s.rating ?? null,
  );
  res.json({ ok: true });
});

app.delete('/api/sessions/today', (_req, res) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  db.prepare('DELETE FROM sessions WHERE started_at >= ?').run(start.getTime());
  res.json({ ok: true });
});

// ── Day log routes ────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

app.get('/api/day', (_req, res) => {
  const row = db.prepare('SELECT * FROM day_log WHERE date = ?').get(todayKey());
  res.json(
    row ? { date: row.date, startedAt: row.started_at, endedAt: row.ended_at ?? null } : null,
  );
});

app.post('/api/day/start', (_req, res) => {
  const key = todayKey();
  db.prepare('INSERT OR IGNORE INTO day_log (date, started_at) VALUES (?, ?)').run(key, Date.now());
  const row = db.prepare('SELECT * FROM day_log WHERE date = ?').get(key);
  res.json({ date: row.date, startedAt: row.started_at, endedAt: row.ended_at ?? null });
});

app.post('/api/day/end', (_req, res) => {
  db.prepare('UPDATE day_log SET ended_at = ? WHERE date = ?').run(Date.now(), todayKey());
  res.json({ ok: true });
});

app.post('/api/day/reset', (_req, res) => {
  const key = todayKey();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  db.prepare('DELETE FROM day_log WHERE date = ?').run(key);
  db.prepare('DELETE FROM sessions WHERE started_at >= ?').run(start.getTime());
  res.json({ ok: true });
});

// ── printd proxy ─────────────────────────────────────────────────────────────
// Same-origin shim over the printd service (https://github.com/HansF/printd).
// The bearer key (PRINT_SERVICE_KEY) lives only here, never in the browser.
// Routes mirror the printd API surface so src/lib/printd.ts can import the
// same paths verbatim. /api/print keeps the legacy { imageData } body shape
// because old static builds may still be in users' caches.

function relayJson(method, path, transformBody) {
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return async (req, res) => {
    try {
      const init = { method };
      if (hasBody) {
        const body = transformBody ? transformBody(req.body || {}) : (req.body ?? {});
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(body);
      }
      const r = await printdFetch(path, init);
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error(`[printd ${path}]`, err.message);
      res.status(502).json({ error: `printd unreachable: ${err.message}` });
    }
  };
}

app.get('/api/healthz', relayJson('GET', '/healthz'));
app.get('/api/status', relayJson('GET', '/status'));
app.post(
  '/api/feed',
  relayJson('POST', '/feed', (b) => ({ lines: b.lines ?? 3 })),
);
app.post(
  '/api/cut',
  relayJson('POST', '/cut', (b) => ({ partial: !!b.partial })),
);

app.post('/api/print', async (req, res) => {
  const { imageData, cut = true } = req.body || {};
  console.log(`[print] ${new Date().toISOString()} cut=${cut} bytes=${imageData?.length ?? 0}`);

  if (!imageData || !imageData.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Missing or invalid imageData field' });
  }

  try {
    const r = await printdFetch('/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: imageData, cut }),
    });
    if (!r.ok) {
      console.error('[print error]', r.status, r.body);
      return res.status(r.status).json(r.body);
    }
    res.json({ success: true, ...r.body });
  } catch (err) {
    console.error('[print error]', err.message);
    res.status(502).json({ error: `printd unreachable: ${err.message}` });
  }
});

app.post('/api/caricature', async (req, res) => {
  const { base64Image } = req.body;
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' });

  const apiKey = process.env.GEMINI_API_KEY;
  const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'; // "Nano Banana"
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: imageModel,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          {
            text: `Draw a flattering, whimsical caricature of the person in the photo. Tight close-up of just the face — head only, no shoulders, no body, no background scene. Designed to print at the top of a paper receipt next to someone's name so people can put a face to the name.

Keep the person's face clearly recognisable — same hairstyle, glasses, smile, beard, or other distinctive features. Gentle, complimentary exaggeration of one or two distinctive features. Stay warm — never mean. Do not emphasise weight, age, or wrinkles.

Style rules — follow these strictly:
- Pure black ink on a pure white background. No gray, no shading, no gradients, no cross-hatching, no solid black fills, no halftones.
- THICK, bold, confident hand-drawn lines — like a brush pen or fat marker. Lines must survive 1-bit thresholding on a thermal printer.
- Tight close-up of the face, filling the frame. The head should reach near the top and bottom edges with only a small white margin.
- Simple, expressive features: clear eyes, simple nose, clear mouth.
- No clothing, no shoulders, no scenery, no decorative borders, no text. Just the face on white.
- Output must be legible when printed on an 80 mm thermal receipt printer at roughly 570 pixels wide.

Return only the image.`,
          },
        ],
      },
    });

    const candidate = response.candidates?.[0];
    for (const part of candidate?.content?.parts || []) {
      if (part.inlineData) {
        return res.json({ imageData: `data:image/png;base64,${part.inlineData.data}` });
      }
    }

    // No image came back. Surface why — usually a safety block, a text-only
    // response, or a finish-reason other than STOP.
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const promptFeedback = response.promptFeedback;
    const textParts = (candidate?.content?.parts || [])
      .map((p) => p.text)
      .filter(Boolean)
      .join(' ')
      .slice(0, 300);
    const safety = candidate?.safetyRatings?.filter((r) => r.blocked || r.probability === 'HIGH');

    console.error('[caricature] no image returned', {
      model: imageModel,
      finishReason,
      textParts: textParts || null,
      safetyBlocks: safety,
      promptFeedback,
    });

    let detail = `finishReason=${finishReason}`;
    if (textParts) detail += `; model said: "${textParts}"`;
    if (safety?.length) detail += `; safety: ${safety.map((s) => s.category).join(', ')}`;
    if (promptFeedback?.blockReason)
      detail += `; promptFeedback.blockReason=${promptFeedback.blockReason}`;

    throw new Error(`Model ${imageModel} returned no image (${detail})`);
  } catch (err) {
    console.error('[caricature error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Exchange Terminal API listening on http://localhost:3001'));
