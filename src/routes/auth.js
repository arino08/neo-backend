const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// POST /auth/send-otp
// Body: { phone: "+919876543210" }
// Generates a 6-digit OTP, stores it with 10-min expiry
router.post('/send-otp', async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  try {
    await db.query(
      `INSERT INTO farmer_accounts (phone, name, otp, otp_expires_at, otp_attempts, verified)
       VALUES ($1, $2, $3, $4, 0, FALSE)
       ON CONFLICT (phone) DO UPDATE SET
         otp = $3,
         otp_expires_at = $4,
         otp_attempts = 0,
         name = COALESCE($2, farmer_accounts.name)`,
      [phone, name || null, otp, expiresAt]
    );

    // Log OTP to console for demo (replace with actual SMS in production)
    console.log(`\n📱 OTP for ${phone}: ${otp}\n`);

    // In production, send via SMS here:
    // await sendSms(phone, `Your NeoAgri OTP is ${otp}. Valid for 10 minutes.`);

    res.json({ ok: true, message: 'OTP sent' });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /auth/verify-otp
// Body: { phone, otp }
// Returns auth_token on success
router.post('/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return res.status(400).json({ error: 'Phone and OTP required' });

  try {
    const result = await db.query(
      'SELECT * FROM farmer_accounts WHERE phone = $1',
      [phone]
    );

    const farmer = result.rows[0];
    if (!farmer) return res.status(404).json({ error: 'Phone not found. Request OTP first.' });

    // Check expiry
    if (new Date() > new Date(farmer.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }

    // Check attempts (max 5)
    if (farmer.otp_attempts >= 5) {
      return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
    }

    if (farmer.otp !== String(otp)) {
      await db.query(
        'UPDATE farmer_accounts SET otp_attempts = otp_attempts + 1 WHERE phone = $1',
        [phone]
      );
      const remaining = 4 - farmer.otp_attempts;
      return res.status(400).json({ error: `Wrong OTP. ${remaining} attempts left.` });
    }

    // Valid OTP — issue auth token
    const token = generateToken();
    await db.query(
      'UPDATE farmer_accounts SET verified = TRUE, auth_token = $1, otp = NULL WHERE phone = $2',
      [token, phone]
    );

    res.json({
      ok: true,
      token,
      farmer: { phone: farmer.phone, name: farmer.name },
    });
  } catch (err) {
    console.error('Verify OTP error:', err.message);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// GET /auth/me
// Header: Authorization: Bearer <token>
// Returns farmer profile
router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const result = await db.query(
      'SELECT id, phone, name, verified, created_at FROM farmer_accounts WHERE auth_token = $1',
      [token]
    );
    if (!result.rows[0]) return res.status(401).json({ error: 'Invalid token' });
    res.json({ farmer: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
