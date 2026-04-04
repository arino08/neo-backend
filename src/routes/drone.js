const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// POST /drone/book — Create a new drone booking
router.post('/book', async (req, res) => {
  try {
    const {
      farmer_name = 'Unknown',
      crop_type = 'soybean',
      area_acres = 1,
      urgency = 'normal',
      latitude,
      longitude,
      notes
    } = req.body;

    const booking_id = `DRN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const result = await db.query(
      `INSERT INTO drone_bookings (booking_id, farmer_name, crop_type, area_acres, urgency, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [booking_id, farmer_name, crop_type, area_acres, urgency, latitude || null, longitude || null, notes || null]
    );

    res.status(201).json({
      ok: true,
      booking: result.rows[0],
    });
  } catch (err) {
    console.error('Drone booking error:', err.message);
    res.status(500).json({ error: 'Booking failed', detail: err.message });
  }
});

// GET /drone/bookings — List all bookings (for operator dashboard)
router.get('/bookings', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM drone_bookings';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Fetch bookings error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /drone/bookings/:id — Get single booking
router.get('/bookings/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM drone_bookings WHERE booking_id = $1 OR id = $2',
      [req.params.id, parseInt(req.params.id) || 0]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /drone/bookings/:id/dispatch — Mark booking as dispatched
router.patch('/bookings/:id/dispatch', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE drone_bookings
       SET status = 'dispatched', dispatched_at = NOW()
       WHERE (booking_id = $1 OR id = $2) AND status = 'pending'
       RETURNING *`,
      [req.params.id, parseInt(req.params.id) || 0]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found or already dispatched' });
    res.json({ ok: true, booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /drone/bookings/:id/complete — Mark booking as completed with scan results
// Also auto-inserts detected diseases as drone_markers so mobile app picks them up via GET /markers
router.patch('/bookings/:id/complete', async (req, res) => {
  try {
    const { scan_results } = req.body;
    const result = await db.query(
      `UPDATE drone_bookings
       SET status = 'completed', completed_at = NOW(), scan_results = $3
       WHERE (booking_id = $1 OR id = $2) AND status IN ('dispatched', 'scanning')
       RETURNING *`,
      [req.params.id, parseInt(req.params.id) || 0, JSON.stringify(scan_results || {})]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found or not dispatched' });

    const booking = result.rows[0];

    // Auto-insert scan_results detections as drone_markers for mobile sync
    if (scan_results && Array.isArray(scan_results.detections)) {
      for (const det of scan_results.detections) {
        try {
          await db.query(
            `INSERT INTO drone_markers (capture_id, latitude, longitude, disease, confidence)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (capture_id) DO NOTHING`,
            [
              det.capture_id || `${booking.booking_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              det.latitude || booking.latitude,
              det.longitude || booking.longitude,
              det.disease,
              det.confidence || 0.85,
            ]
          );
        } catch (insertErr) {
          console.warn('Marker insert skipped:', insertErr.message);
        }
      }
    }

    res.json({ ok: true, booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /drone/bookings/:id/cancel — Cancel a booking
router.patch('/bookings/:id/cancel', async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE drone_bookings
       SET status = 'cancelled'
       WHERE (booking_id = $1 OR id = $2) AND status = 'pending'
       RETURNING *`,
      [req.params.id, parseInt(req.params.id) || 0]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found or cannot cancel' });
    res.json({ ok: true, booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /drone/stats — Quick stats for dashboard
router.get('/stats', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'dispatched') as dispatched,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as total
      FROM drone_bookings
    `);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
