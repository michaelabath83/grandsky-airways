const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK (use default credentials when deployed)
try { admin.initializeApp(); } catch(e) { console.warn('admin already initialized'); }
const db = admin.firestore();

// Basic booking creation callable
exports.createBooking = functions.https.onCall(async (data, context) => {
  // Require authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }

  const uid = context.auth.uid;
  // Basic payload validation
  const passenger = data.passenger || {};
  const flight = data.flight || {};
  const payment = data.payment || {};

  if (!passenger.firstName || !passenger.lastName || !passenger.email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing passenger info');
  }
  if (!flight.from || !flight.to || !flight.departDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing flight info');
  }

  // Generate bookingRef
  const bookingRef = ("GSA-" + Math.random().toString(36).substr(2,6).toUpperCase()).slice(0,10);

  const now = admin.firestore.FieldValue.serverTimestamp();
  const booking = {
    bookingRef,
    userId: uid,
    passenger: {
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      email: passenger.email,
      phone: passenger.phone || null
    },
    flight: {
      from: flight.from,
      to: flight.to,
      departDate: flight.departDate,
      dep: flight.dep || null,
      arr: flight.arr || null,
      airline: flight.airline || null,
      pax: flight.pax || 1,
      cabinClass: flight.cabinClass || 'economy'
    },
    payment: {
      method: payment.method || 'crypto',
      amount: payment.amount || 0,
      currency: payment.currency || 'USD',
      coin: payment.coin || null,
      walletAddress: payment.walletAddress || null,
      cryptoAmount: payment.cryptoAmount || null,
      submittedAt: payment.submittedAt || null
    },
    status: data.status || 'pending_payment',
    createdAt: now,
    updatedAt: now
  };

  try {
    const docRef = await db.collection('bookings').add(booking);

    // If payment already submitted, create payments doc and enqueue email
    if (booking.payment && booking.payment.submittedAt) {
      await db.collection('payments').add({
        bookingId: docRef.id,
        bookingRef,
        coin: booking.payment.coin,
        walletAddress: booking.payment.walletAddress,
        amountUSD: booking.payment.amount,
        cryptoAmount: booking.payment.cryptoAmount,
        submittedAt: booking.payment.submittedAt,
        status: 'submitted'
      });

      await db.collection('emailQueue').add({
        to: 'admin@grandsky.com',
        subject: `New Payment Submission — ${bookingRef}`,
        body: `<p>Payment submitted for booking ${bookingRef}.</p>`,
        status: 'pending',
        createdAt: now
      });
    }

    return { bookingId: docRef.id, bookingRef };
  } catch (err) {
    console.error('createBooking error', err);
    throw new functions.https.HttpsError('internal', 'Failed to create booking');
  }
});

  // Submit payment callable — marks booking submitted, creates payment and emailQueue
  exports.submitPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }
    const uid = context.auth.uid;
    const bookingId = data.bookingId;
    const coin = data.coin || null;
    const walletAddress = data.walletAddress || null;
    const cryptoAmount = data.cryptoAmount || null;

    if (!bookingId) throw new functions.https.HttpsError('invalid-argument', 'Missing bookingId');

    const now = admin.firestore.FieldValue.serverTimestamp();
    try {
      const bref = db.collection('bookings').doc(bookingId);
      await bref.update({
        status: 'payment_submitted',
        'payment.coin': coin,
        'payment.walletAddress': walletAddress,
        'payment.cryptoAmount': cryptoAmount,
        'payment.submittedAt': now,
        updatedAt: now
      });

      const bookingSnap = await bref.get();
      const bookingRef = bookingSnap.exists ? bookingSnap.data().bookingRef : null;

      await db.collection('payments').add({
        bookingId,
        bookingRef,
        coin,
        walletAddress,
        amountUSD: data.amountUSD || 0,
        cryptoAmount,
        submittedAt: now,
        status: 'submitted'
      });

      await db.collection('emailQueue').add({
        to: 'admin@grandsky.com',
        subject: `New Payment Submission — ${bookingRef || bookingId}`,
        body: `<p>Payment submitted for booking ${bookingRef || bookingId}.</p>`,
        status: 'pending',
        createdAt: now
      });

      return { ok: true };
    } catch (err) {
      console.error('submitPayment error', err);
      throw new functions.https.HttpsError('internal', 'Failed to submit payment');
    }
  });
