import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'Invalid token' });

    const body = req.body || {};
    // Insert payment record
    const pay = {
      booking_id: body.bookingId || null,
      provider: body.provider || body.coin || 'crypto',
      amount_usd: body.amountUSD || body.amount || 0,
      metadata: body,
      status: 'submitted'
    };
    const inserted = await sb.from('payments').insert(pay).select('id').single();
    if (inserted.error) throw inserted.error;

    // update booking status
    if (body.bookingId) {
      await sb.from('bookings').update({ status: 'payment_submitted', updated_at: new Date().toISOString() }).eq('id', body.bookingId);
    }

    return res.status(200).json({ paymentId: inserted.data.id });
  } catch (err) {
    console.error('submitPayment error', err);
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

    const data = req.body || {};
    const bookingId = data.bookingId;
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });

    const now = admin.firestore.FieldValue.serverTimestamp();

    const bref = admin.firestore().collection('bookings').doc(bookingId);
    await bref.update({
      status: 'payment_submitted',
      'payment.coin': data.coin || null,
      'payment.walletAddress': data.walletAddress || null,
      'payment.cryptoAmount': data.cryptoAmount || null,
      'payment.submittedAt': now,
      updatedAt: now
    });

    const snap = await bref.get();
    const bookingRef = snap.exists ? snap.data().bookingRef : null;

    await admin.firestore().collection('payments').add({
      bookingId,
      bookingRef,
      coin: data.coin || null,
      walletAddress: data.walletAddress || null,
      amountUSD: data.amountUSD || 0,
      cryptoAmount: data.cryptoAmount || null,
      submittedAt: now,
      status: 'submitted'
    });

    await admin.firestore().collection('emailQueue').add({
      to: 'admin@grandsky.com',
      subject: `New Payment Submission — ${bookingRef || bookingId}`,
      body: `<p>Payment submitted for booking ${bookingRef || bookingId}.</p>`,
      status: 'pending',
      createdAt: now
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('submitPayment error', err);
    return res.status(500).json({ error: err.message || 'internal' });
  }
};
