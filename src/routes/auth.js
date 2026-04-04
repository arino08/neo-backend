const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');

// Twilio (optional — gracefully falls back to console.log if not configured)
let twilioClient = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH && process.env.TWILIO_PHONE) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH);
    console.log('✓ Twilio SMS enabled');
  } catch {
    console.log('⚠ Twilio package not installed — using console OTP');
  }
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function sendOtpSms(phone, otp) {
  if (twilioClient) {
    try {
      await twilioClient.messages.create({
        body: `NeoAgri OTP: ${otp} — 10 मिनट में समाप्त।`,
        from: process.env.TWILIO_PHONE,
        to: phone,
      });
      console.log(`📱 OTP sent via SMS to ${phone}`);
      return true;
    } catch (err) {
      console.error('Twilio SMS failed:', err.message);
    }
  }
  // Fallback: console log for demo
  console.log(`\n📱 OTP for ${phone}: ${otp}\n`);
  return false;
}

// POST /auth/send-otp
router.post('/send-otp', async (req, res) => {
  const { phone, name } = req.body;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

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

    const sentViaSms = await sendOtpSms(phone, otp);

    res.json({ ok: true, message: 'OTP sent', channel: sentViaSms ? 'sms' : 'console' });
  } catch (err) {
    console.error('Send OTP error:', err.message);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// POST /auth/verify-otp
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

    if (new Date() > new Date(farmer.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }

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
