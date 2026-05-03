'use strict';

require('dotenv').config();

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10mb' }));

const PRINTER_SCRIPT = path.join(__dirname, 'printer', 'xp80t.py');
const PYTHON = path.join(__dirname, 'printer', 'venv', 'bin', 'python3');

app.post('/api/print', async (req, res) => {
  const { imageData } = req.body;

  if (!imageData || !imageData.startsWith('data:image/png;base64,')) {
    return res.status(400).json({ error: 'Missing or invalid imageData field' });
  }

  const base64 = imageData.replace('data:image/png;base64,', '');
  const imgBuffer = Buffer.from(base64, 'base64');
  const tmpFile = path.join('/tmp', `ticket-${crypto.randomUUID()}.png`);

  try {
    fs.writeFileSync(tmpFile, imgBuffer);

    await new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, [PRINTER_SCRIPT, 'image', tmpFile], {
        stdio: ['ignore', 'inherit', 'pipe'],
      });

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
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
          {
            text: `Transform this person into a ${creature.name} caricature.
Keep their face recognisable but merge it with these ${creature.name} traits: ${creature.traits}.
Exaggerate both their own facial features AND the creature traits for maximum comic effect.
Style: Bold black line art on a pure white background.
Output ONLY black and white lines — no shades of gray, no gradients, no fills, no shadows.
Minimalist, high contrast, thick strokes. Suitable for a low-resolution thermal ticket printer.`,
          },
        ],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return res.json({ imageData: `data:image/png;base64,${part.inlineData.data}`, creature: creature.name });
      }
    }
    throw new Error('No image returned by Gemini');
  } catch (err) {
    console.error('[caricature error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, () => console.log('Print server listening on http://localhost:3001'));
