CREATE TABLE IF NOT EXISTS voice_logs (
  id SERIAL PRIMARY KEY,
  session_id TEXT,
  command TEXT,
  tool_called TEXT,
  result_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
