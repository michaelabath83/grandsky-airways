-- Supabase initial schema for GrandSky
CREATE TABLE bookings (
  id serial PRIMARY KEY,
  booking_ref text UNIQUE NOT NULL,
  user_id text,
  passenger_first text,
  passenger_last text,
  passenger_email text,
  passenger_phone text,
  flight_json jsonb,
  status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE payments (
  id serial PRIMARY KEY,
  booking_id int REFERENCES bookings(id) ON DELETE CASCADE,
  provider text,
  amount_usd numeric(10,2),
  metadata jsonb,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE email_queue (
  id serial PRIMARY KEY,
  to_email text,
  subject text,
  body jsonb,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_payments_booking_id ON payments(booking_id);
