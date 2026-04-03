const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/receive', async (req, res) => {
  const { schema_version, type, payload } = req.body;
  if (schema_version !== '1.0' || type !== 'leaf_capture') {
    return res.status(400).json({ error: 'Invalid schema or type' });
  }

  try {
    await db.query(
      `INSERT INTO drone_markers (capture_id, latitude, longitude, disease, confidence, leaf_image_b64)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (capture_id) DO NOTHING`,
      [
        payload.capture_id, payload.latitude, payload.longitude,
        payload.model_result.disease, payload.model_result.confidence, payload.leaf_image_b64
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
