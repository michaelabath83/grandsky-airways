-- Ensure profiles table exists (safe migration)

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  first_name text,
  last_name text,
  email text,
  dob date,
  nationality text,
  passport text,
  passport_expiry date,
  phone text,
  role text,
  marketing boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
