'use strict';

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

app.listen(3001, () => console.log('Print server listening on http://localhost:3001'));
