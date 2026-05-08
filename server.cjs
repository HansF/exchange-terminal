'use strict';

require('dotenv').config();

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── SQLite setup ──────────────────────────────────────────────────────────────

const DB_PATH = path.join(__dirname, 'data', 'todo.db');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  DROP TABLE IF EXISTS todos;
  DROP TABLE IF EXISTS sessions;
  DROP TABLE IF EXISTS day_log;
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
  db.prepare(`
    INSERT INTO sessions (id, started_at, ended_at, duration_seconds, planned_seconds, was_abandoned, tags, rating)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(s.id, s.startedAt, s.endedAt, s.durationSeconds, s.plannedSeconds, s.wasAbandoned ? 1 : 0, JSON.stringify(s.tags ?? []), s.rating ?? null);
  res.json({ ok: true });
});

app.delete('/api/sessions/today', (_req, res) => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  db.prepare('DELETE FROM sessions WHERE started_at >= ?').run(start.getTime());
  res.json({ ok: true });
});

// ── Day log routes ────────────────────────────────────────────────────────────

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

app.get('/api/day', (_req, res) => {
  const row = db.prepare('SELECT * FROM day_log WHERE date = ?').get(todayKey());
  res.json(row ? { date: row.date, startedAt: row.started_at, endedAt: row.ended_at ?? null } : null);
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
  const start = new Date(); start.setHours(0, 0, 0, 0);
  db.prepare('DELETE FROM day_log WHERE date = ?').run(key);
  db.prepare('DELETE FROM sessions WHERE started_at >= ?').run(start.getTime());
  res.json({ ok: true });
});

// ── Cut route ─────────────────────────────────────────────────────────────────

app.post('/api/cut', (_req, res) => {
  const proc = require('child_process').spawn(PYTHON, [PRINTER_SCRIPT, 'cut'], { stdio: 'ignore' });
  proc.on('close', code => code === 0 ? res.json({ ok: true }) : res.status(500).json({ error: `exit ${code}` }));
  proc.on('error', err => res.status(500).json({ error: err.message }));
});

const PRINTER_SCRIPT = path.join(__dirname, 'printer', 'xp80t.py');
const PYTHON = path.join(__dirname, 'printer', 'venv', 'bin', 'python3');

app.post('/api/print', async (req, res) => {
  const { imageData, cut = true } = req.body;
  console.log(`[print] ${new Date().toISOString()} cut=${cut} bytes=${imageData?.length ?? 0}`);

  if (!imageData || !imageData.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Missing or invalid imageData field' });
  }

  const base64 = imageData.replace('data:image/png;base64,', '');
  const imgBuffer = Buffer.from(base64, 'base64');
  const tmpFile = path.join('/tmp', `ticket-${crypto.randomUUID()}.png`);

  try {
    fs.writeFileSync(tmpFile, imgBuffer);

    const args = [PRINTER_SCRIPT, 'image', tmpFile];
    if (!cut) args.push('--no-cut');

    await new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, args, { stdio: ['ignore', 'inherit', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      proc.on('close', (code) => {
        code === 0 ? resolve() : reject(new Error(stderr || `python3 exited with code ${code}`));
      });
      proc.on('error', (err) => reject(new Error(`Failed to start python3: ${err.message}`)));
    });

    res.json({ success: true });

  } catch (err) {
    console.error('[print error]', err.message);
    res.status(500).json({ error: err.message });

  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
});

app.post('/api/caricature', async (req, res) => {
  const { base64Image } = req.body;
  if (!base64Image) return res.status(400).json({ error: 'Missing base64Image' });

  const apiKey = process.env.GEMINI_API_KEY;
  const imageModel = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'; // "Nano Banana"
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });

  const CREATURES = [
    { name: 'goblin',    traits: 'pointy ears, wide grin full of uneven teeth, bulbous warty nose, mischievous squinting eyes, wild scraggly hair, small hunched posture' },
    { name: 'fairy',     traits: 'delicate insect wings sprouting from back, slightly pointed ears, large luminous eyes, ethereal flowing hair, slender graceful features, tiny stature' },
    { name: 'pixie',     traits: 'oversized pointed ears, enormous bright eyes taking up half the face, button nose, cheeky grin, wild spiky hair, small compact body' },
    { name: 'leprechaun', traits: 'tall buckled hat, thick bushy beard or sideburns, rosy round cheeks, twinkling eyes, stout barrel-chested body, mischievous smirk' },
    { name: 'dragon',    traits: 'small curved horns on forehead, slit reptilian pupils, faint scale texture on cheekbones, slightly elongated snout, sharp teeth visible in grin, proud fierce expression' },
    { name: 'troll',     traits: 'enormous bulbous nose taking up a third of the face, tiny beady eyes, protruding underbite with tusks, massive boulder-like jaw, mossy tangled hair' },
    { name: 'witch',     traits: 'long crooked hooked nose, sharp angular chin, deep-set piercing eyes under a tall pointed hat, wild flowing hair, knowing wry smile' },
    { name: 'elf',       traits: 'long elegant pointed ears sweeping back, high sharp cheekbones, almond-shaped eyes with an otherworldly gaze, slender jawline, ageless serene expression' },
    { name: 'gnome',     traits: 'enormous round pointy hat, extremely long white bushy beard, rosy bulbous cheeks, tiny twinkling eyes nearly hidden by eyebrows, short stout frame' },
    { name: 'werewolf',  traits: 'slightly elongated snout, prominent brow ridge, faint fur texture along jawline and forehead, yellow eyes, sharp canine teeth, wild untamed hair' },
  ];

  const creature = CREATURES[Math.floor(Math.random() * CREATURES.length)];

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: imageModel,
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          {
            text: `Transform this person into a ${creature.name} in the illustration style of Fiep Westendorp.
Keep the face loosely recognisable but reinterpret it as a ${creature.name} with these traits: ${creature.traits}.

Style rules — follow these strictly:
- Fiep Westendorp's iconic Dutch children's book style (Jip en Janneke)
- Thin, fluid, slightly wobbly hand-drawn lines — NOT thick or bold
- Round simplified face with tiny dot or dash eyes, small button nose, simple curved mouth
- Flat silhouette with minimal interior detail; clothing suggested by a few simple lines or tiny patterns (dots, stripes)
- Playful, innocent, slightly naive quality — charming not scary
- Pure black lines on a white background only — no gray, no shading, no gradients, no fills
- Leave generous white space; do not fill areas with black
- Suitable for thermal receipt printer output`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.json({ imageData: `data:image/png;base64,${part.inlineData.data}`, creature: creature.name });
      }
    }
    throw new Error(`No image returned by model: ${imageModel}`);
  } catch (err) {
    console.error('[caricature error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Print server listening on http://localhost:3001'));
