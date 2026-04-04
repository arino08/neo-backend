CREATE TABLE IF NOT EXISTS drone_bookings (
  id SERIAL PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL,
  farmer_name TEXT DEFAULT 'Unknown',
  crop_type TEXT DEFAULT 'soybean',
  area_acres NUMERIC DEFAULT 1,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'scanning', 'completed', 'cancelled')),
  latitude NUMERIC,
  longitude NUMERIC,
  scan_results JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
