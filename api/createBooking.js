const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON || '{}');
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
