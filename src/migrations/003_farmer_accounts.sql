CREATE TABLE IF NOT EXISTS farmer_accounts (
  id SERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  otp TEXT,
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  auth_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_phone ON farmer_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_farmer_token ON farmer_accounts(auth_token);
