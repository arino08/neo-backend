CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS drone_markers (
  id SERIAL PRIMARY KEY,
  capture_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  disease TEXT,
  confidence DOUBLE PRECISION,
  leaf_image_b64 TEXT,
  schema_version TEXT DEFAULT '1.0',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manual_scans (
  id SERIAL PRIMARY KEY,
  capture_id UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  disease TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  timestamp_utc TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
