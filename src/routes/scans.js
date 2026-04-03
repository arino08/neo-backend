const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/sync', async (req, res) => {
  const { scans } = req.body;
  
  if (!Array.isArray(scans)) {
    return res.status(400).json({ error: 'scans must be an array' });
  }

  let synced = 0;
  try {
    for (const scan of scans) {
      await db.query(
        `INSERT INTO manual_scans (capture_id, latitude, longitude, disease, confidence, timestamp_utc)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (capture_id) DO NOTHING`,
        [scan.capture_id, scan.latitude, scan.longitude, scan.disease, scan.confidence, scan.timestamp]
      );
      synced++;
    }
    res.json({ synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
