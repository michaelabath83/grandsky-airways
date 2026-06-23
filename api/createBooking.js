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
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  let svc = null;
  // Accept multiple ways to provide the service account:
  // 1) SERVICE_ACCOUNT_BASE64 (recommended for Vercel env var) -> base64-encoded JSON
  // 2) SERVICE_ACCOUNT_JSON -> raw JSON string
  // 3) GOOGLE_APPLICATION_CREDENTIALS path to a file (fallback)
  if (process.env.SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      svc = JSON.parse(decoded);
    } catch (e) {
      throw new Error('Invalid SERVICE_ACCOUNT_BASE64: failed to decode/parse JSON');
    }
  } else if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
      svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('Invalid SERVICE_ACCOUNT_JSON: failed to parse JSON');
    }
  }

  if (!svc) {
    const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json';
    try {
      svc = require(require('path').resolve(svcPath));
    } catch (e) {
      throw new Error('Service account not found. Set SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON file');
    }
  }

  if (!svc || typeof svc.project_id !== 'string') {
    throw new Error('Service account object must contain a string "project_id" property. Ensure your service account JSON is valid');
  }

  return admin.initializeApp({ credential: admin.credential.cert(svc) });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.replace(/^Bearer\s+/i, '');
    if (!idToken) return res.status(401).json({ error: 'Missing ID token' });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const payload = req.body || {};
    // Basic validation
    if (!payload.passenger || !payload.flight) return res.status(400).json({ error: 'Missing payload' });

    const bookingRef = payload.bookingRef || ('GSA-' + Math.random().toString(36).slice(2,8).toUpperCase());

    const booking = {
      bookingRef,
      userId: uid,
      passenger: payload.passenger,
      flight: payload.flight,
      payment: payload.payment || { method: 'crypto' },
      status: payload.status || 'pending_payment',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await admin.firestore().collection('bookings').add(booking);
    return res.json({ bookingId: docRef.id, bookingRef });
  } catch (err) {
    console.error('createBooking error', err);
    return res.status(500).json({ error: err.message || 'internal' });
  }
};
