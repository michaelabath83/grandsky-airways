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
