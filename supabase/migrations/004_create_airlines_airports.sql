-- Create airlines and airports tables expected by seeder and upload script

CREATE TABLE IF NOT EXISTS airlines (
  code text PRIMARY KEY,
  name text,
  logo_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS airports (
  code text PRIMARY KEY,
  city text,
  country text,
  name text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_airlines_code ON airlines(code);
CREATE INDEX IF NOT EXISTS idx_airports_code ON airports(code);
