const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/markers', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT capture_id, latitude, longitude, disease, confidence, created_at
       FROM drone_markers ORDER BY created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
