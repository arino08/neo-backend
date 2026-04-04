const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/session', async (req, res) => {
  try {
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime', voice: 'alloy' }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data });
    res.json({
      client_secret: data.client_secret.value,
      session_id: data.id,
      expires_at: data.client_secret.expires_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/log', async (req, res) => {
  const { session_id, command, tool_called, result_preview } = req.body;
  try {
    await db.query(
      `INSERT INTO voice_logs (session_id, command, tool_called, result_preview) VALUES ($1,$2,$3,$4)`,
      [session_id, command, tool_called, result_preview]
    );
  } catch (_) { /* non-critical */ }
  res.json({ ok: true });
});

module.exports = router;
