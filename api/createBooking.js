// API v2 - CORS-enabled booking endpoint
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase env not configured');
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // CORS headers - allow browser clients (adjust origin as needed for production)
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests quickly to avoid redirects which break CORS
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    // verify token and get user
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    const body = req.body || {};
    const bookingRef = body.bookingRef || ('GSA-' + Math.random().toString(36).slice(2,8).toUpperCase());

    const payload = {
      booking_ref: bookingRef,
      user_id: user.id,
      passenger_first: body.passenger?.firstName || '',
      passenger_last: body.passenger?.lastName || '',
      passenger_email: body.passenger?.email || '',
      passenger_phone: body.passenger?.phone || '',
      flight_json: body.flight || {},
      status: body.status || 'pending_payment'
    };

    const insert = await sb.from('bookings').insert(payload).select('id').single();
    if (insert.error) throw insert.error;
    return res.status(200).json({ bookingId: insert.data.id, bookingRef });
  } catch (err) {
    console.error('createBooking error', err);
    return res.status(500).json({ error: String(err) });
  }
}
