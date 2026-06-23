-- Add profiles, tickets, admin_logs and flights tables

CREATE TABLE profiles (
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

CREATE TABLE tickets (
  id serial PRIMARY KEY,
  booking_id int REFERENCES bookings(id) ON DELETE CASCADE,
  booking_ref text,
  ticket_number text UNIQUE,
  passenger jsonb,
  flight jsonb,
  issued_at timestamptz DEFAULT now(),
  issued_by text,
  pdf_generated boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz
);

CREATE TABLE admin_logs (
  id serial PRIMARY KEY,
  action text,
  booking_ref text,
  admin_email text,
  timestamp timestamptz DEFAULT now(),
  details text
);

-- Optional flights table (if migrating from Firestore)
CREATE TABLE IF NOT EXISTS flights (
  id serial PRIMARY KEY,
  from_code text,
  to_code text,
  from_city text,
  to_city text,
  airline text,
  price numeric(10,2),
  featured boolean DEFAULT false
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_tickets_booking_id ON tickets(booking_id);
CREATE INDEX idx_admin_logs_booking_ref ON admin_logs(booking_ref);
*** End Patch