// =============================================
// GrandSky Airways — Payment Page Logic
// =============================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, setDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser = null;
let selectedMethod = null;
// Booking status constants (also export to admin.js by keeping same values there)
const BOOKING_STATUS = {
  PENDING_PAYMENT:    'pending_payment',
  PAYMENT_SUBMITTED:  'payment_submitted',
  PAYMENT_APPROVED:   'payment_approved',
  TICKET_SENT:        'ticket_sent',
  PAYMENT_REJECTED:   'payment_rejected',
  CANCELLED:          'cancelled'
};

// Guard: must be logged in
onAuthStateChanged(auth, async user => {
  if (!user) {
    sessionStorage.setItem('postLoginRedirect', 'payment.html');
    window.location.href = 'login.html?redirect=payment.html';
    return;
  }
  currentUser = user;

  // Pre-fill from profile
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const d = snap.data();
      document.getElementById('payFirst').value  = d.firstName || '';
      document.getElementById('payLast').value   = d.lastName  || '';
      document.getElementById('payEmail').value  = d.email     || user.email || '';
      document.getElementById('payPhone').value  = d.phone     || '';
    }
  } catch(e) {}
});

// Load flight data
const flight = JSON.parse(sessionStorage.getItem('selectedFlight') || '{}');
if (!flight.price) {
  window.location.href = '../index.html';
}

// Populate order summary
const taxes  = Math.round(flight.price * 0.13);
const fees   = 18;
const total  = flight.price * (flight.pax || 1) + taxes + fees;

document.getElementById('flightSummary').innerHTML = `
  <div class="flight-summary-card">
    <div class="fs-airline">${flight.airline || 'GrandSky Airways Express'} · ${flight.tripType === 'oneway' ? 'One Way' : 'Round Trip'}</div>
    <div class="fs-route">
      ${flight.from}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      ${flight.to}
    </div>
    <div class="fs-times">${flight.dep || '--:--'} → ${flight.arr || '--:--'} · ${flight.dur || '--'} · ${flight.stops === 0 ? 'Nonstop' : flight.stops + ' stop(s)'}</div>
    <span class="fs-class">${flight.cabinClass || 'Economy'}</span>
  </div>
`;

document.getElementById('priceBreakdown').innerHTML = `
  <div class="pb-row"><span>Base fare (${flight.pax || 1} pax)</span><span>$${flight.price * (flight.pax||1)}</span></div>
  <div class="pb-row"><span>Taxes & surcharges</span><span>$${taxes}</span></div>
  <div class="pb-row"><span>Booking fee</span><span>$${fees}</span></div>
  <div class="pb-row total"><span>Total</span><span>$${total}</span></div>
`;

// ── Countdown timer (seat hold) ──
let seatSeconds = 10 * 60 - 1;
const countEl = document.getElementById('countdown');
const seatTimer = setInterval(() => {
  const m = String(Math.floor(seatSeconds/60)).padStart(2,'0');
  const s = String(seatSeconds % 60).padStart(2,'0');
  countEl.textContent = `${m}:${s}`;
  if (seatSeconds <= 0) { clearInterval(seatTimer); showToast('Your seat hold expired. Please search again.', 'error'); setTimeout(() => window.location.href='../index.html', 3000); }
  seatSeconds--;
}, 1000);

// ── Payment method selection ──
document.querySelectorAll('.method-card').forEach(card => {
  card.addEventListener('click', async () => {
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedMethod = card.dataset.method;

    const cryptoPanel = document.getElementById('cryptoPanel');
    const payBtn = document.getElementById('payBtn');

    if (selectedMethod === 'crypto') {
      cryptoPanel.classList.add('open');
      // disable confirm until booking exists and prevent repeated init
      const confirmBtn = document.getElementById('confirmCryptoBtn');
      confirmBtn.disabled = true;
      try {
        await ensureCryptoBooking();
        bookingInitFailed = false;
      } catch (e) {
        // ensureCryptoBooking already shows appropriate toast
      } finally {
        confirmBtn.disabled = false;
      }
      payBtn.style.display = 'none';
    } else {
      cryptoPanel.classList.remove('open');
      payBtn.style.display = 'block';
    }
  });
});

// ── Crypto panel ──
const WALLET_ADDRESSES = {
  BTC: 'bc1qnsgpucf288w053e43jl2sl7zahzzu02vt4tqru'
};
const RATES = { BTC: 0.0000145 };

let currentCoin = 'BTC';
let qr = null;
updateCryptoUI('BTC');

document.querySelectorAll('.crypto-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.crypto-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCoin = tab.dataset.coin;
    updateCryptoUI(currentCoin);
  });
});

function updateCryptoUI(coin) {
  const amount = (total * RATES[coin]).toFixed(coin === 'USDT' ? 2 : 6);
  document.getElementById('cryptoAmount').textContent = `${amount} ${coin}`;
  const addr = WALLET_ADDRESSES[coin];
  document.getElementById('walletAddr').textContent = addr;
  // Render QR code
  try {
      const qrEl = document.getElementById('qrPlaceholder');
      qrEl.innerHTML = '';
      // If a static QR image is provided for BTC, show it instead of rendering
      try {
        const staticImg = document.getElementById('qrImage');
        if (coin === 'BTC' && staticImg) {
          staticImg.style.display = 'block';
          qrEl.appendChild(staticImg);
          return;
        }
      } catch (e) {}
      // QRCode lib loaded via CDN in the page
      qr = new QRCode(qrEl, { text: addr, width: 160, height: 160 });
  } catch (e) {
    console.error('QR render failed', e);
  }
}

// Crypto expiry timer
let cryptoSecs = 15 * 60;
const cryptoExpEl = document.getElementById('cryptoExpiry');
setInterval(() => {
  const m = String(Math.floor(cryptoSecs/60)).padStart(2,'0');
  const s = String(cryptoSecs%60).padStart(2,'0');
  cryptoExpEl.textContent = `${m}:${s}`;
  if (cryptoSecs > 0) cryptoSecs--;
}, 1000);

// Copy wallet address
document.getElementById('copyAddr').addEventListener('click', () => {
  const addr = WALLET_ADDRESSES[currentCoin];
  navigator.clipboard.writeText(addr).then(() => {
    const btn = document.getElementById('copyAddr');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  }).catch(err => { showToast('Copy failed', 'error'); });
});

// ── Crypto confirm ──
// When crypto panel opens we must create a booking immediately (pending_payment)
const cryptoPanelEl = document.getElementById('cryptoPanel');
let ensureCryptoInFlight = false;
let ensureCryptoPromise = null;
let bookingInitFailed = false;
function ensureCryptoBooking() {
  if (ensureCryptoInFlight && ensureCryptoPromise) return ensureCryptoPromise;
  ensureCryptoInFlight = true;
  ensureCryptoPromise = (async () => {
    // ensure user is available (auth may still be initializing)
    if (!currentUser) {
      const start = Date.now();
      while (!currentUser && (Date.now() - start) < 3000) {
        await new Promise(r => setTimeout(r, 200));
      }
      if (!currentUser) {
        bookingInitFailed = true;
        const err = new Error('User not authenticated');
        showToast('You must be signed in to create a booking.', 'error');
        throw err;
      }
    }
    try {
      const existingBookingId = sessionStorage.getItem('bookingId');
      if (existingBookingId) {
        // fetch and verify booking exists
        try {
          const bdoc = await getDoc(doc(db, 'bookings', existingBookingId));
          if (bdoc.exists()) {
            const b = bdoc.data();
            if (b.bookingRef) showBookingRef(b.bookingRef);
            return { id: existingBookingId, bookingRef: b.bookingRef };
          }
        } catch (e) {
          console.error('Failed to fetch existing booking', e);
        }
      }

      // generate bookingRef and create booking
      const bookingRef = generateBookingRef();
      const booking = {
        bookingRef,
        userId: currentUser ? currentUser.uid : null,
        passenger: {
          firstName: document.getElementById('payFirst').value.trim(),
          lastName:  document.getElementById('payLast').value.trim(),
          email:     document.getElementById('payEmail').value.trim(),
          phone:     document.getElementById('payPhone').value.trim(),
        },
        flight: {
          fromCode: flight.from || '', fromCity: flight.fromCity || '',
          toCode: flight.to || '', toCity: flight.toCity || '',
          dep: flight.dep || '', arr: flight.arr || '', duration: flight.dur || '',
          airline: flight.airline || '', departDate: flight.departDate || '', pax: flight.pax || 1,
          cabinClass: flight.cabinClass || '', stops: flight.stops || 0
        },
        payment: {
          method: 'crypto',
          coin: currentCoin,
          walletAddress: WALLET_ADDRESSES[currentCoin],
          amountDue: total,
          cryptoAmount: (total * RATES[currentCoin]).toFixed(currentCoin === 'USDT' ? 2 : 6),
          submittedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          txNote: null
        },
        status: BOOKING_STATUS.PENDING_PAYMENT,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, 'bookings'), booking);
      sessionStorage.setItem('bookingId', ref.id);
      sessionStorage.setItem('bookingRef', bookingRef);
      showBookingRef(bookingRef);
      return { id: ref.id, bookingRef };
    } catch (err) {
      console.error('ensureCryptoBooking error:', err);
      bookingInitFailed = true;
      const msg = err && err.message ? err.message : 'Failed creating booking. Try again.';
      // Detect permission errors and provide actionable guidance
      const isPerm = err && (err.code === 'permission-denied' || /permission/i.test(err.message));
      if (isPerm) {
        showToast('Booking init failed: Missing or insufficient permissions. Check Firestore rules or sign in with an admin account.', 'error');
        // disable confirm and pay buttons to avoid further errors
        try { document.getElementById('confirmCryptoBtn').disabled = true; } catch(e){}
        try { document.getElementById('payBtn').disabled = true; } catch(e){}
      } else {
        showToast(`Booking init failed: ${msg}`, 'error');
      }
      throw err;
    } finally {
      ensureCryptoInFlight = false;
      ensureCryptoPromise = null;
    }
  })();
  return ensureCryptoPromise;
}

function showBookingRef(ref) {
  const el = document.getElementById('bookingRefDisplay');
  const txt = document.getElementById('bookingRefText');
  txt.textContent = ref;
  el.style.display = 'block';
}

function generateBookingRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return 'GSA-' + s;
}

// attach handler for confirm (user clicked "I've sent the payment")
document.getElementById('confirmCryptoBtn').addEventListener('click', async () => {
  try {
    if (!validatePassengerDetails()) return;
    // Ensure booking exists; await creation if in-flight
    try {
      if (!sessionStorage.getItem('bookingId') || !sessionStorage.getItem('bookingRef')) {
        await ensureCryptoBooking();
      }
    } catch (err) {
      showToast('Booking initialization failed. Please reload and try again.', 'error');
      return;
    }
    const bookingId = sessionStorage.getItem('bookingId');
    const bookingRef = sessionStorage.getItem('bookingRef');
    if (!bookingId || !bookingRef) { showToast('Booking not found. Please reload.', 'error'); return; }

    const confirmMsg = `Please confirm you have sent the exact amount (${document.getElementById('cryptoAmount').textContent}) to ${WALLET_ADDRESSES[currentCoin]}.\n\nClick OK to submit for review.`;
    if (!window.confirm(confirmMsg)) return;

    const btn = document.getElementById('confirmCryptoBtn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    // update booking status
    await updateDoc(doc(db, 'bookings', bookingId), {
      'status': BOOKING_STATUS.PAYMENT_SUBMITTED,
      'payment.submittedAt': serverTimestamp(),
      'payment.coin': currentCoin,
      'payment.walletAddress': WALLET_ADDRESSES[currentCoin],
      'payment.cryptoAmount': (total * RATES[currentCoin]).toFixed(currentCoin === 'USDT' ? 2 : 6),
      'updatedAt': serverTimestamp()
    });

    // create payments doc
    await addDoc(collection(db, 'payments'), {
      bookingId,
      bookingRef,
      coin: currentCoin,
      walletAddress: WALLET_ADDRESSES[currentCoin],
      amountUSD: total,
      cryptoAmount: (total * RATES[currentCoin]).toFixed(currentCoin === 'USDT' ? 2 : 6),
      submittedAt: serverTimestamp(),
      userNote: null,
      status: 'submitted',
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null
    });

    // enqueue admin email
    await addDoc(collection(db, 'emailQueue'), {
      to: 'admin@grandsky.com',
      subject: `New Payment Submission — ${bookingRef}`,
      body: `<p>Payment submitted for booking ${bookingRef}.</p>`,
      attachmentNote: null,
      status: 'pending',
      retryCount: 0,
      createdAt: serverTimestamp(),
      sentAt: null,
      error: null
    });

    // redirect to confirmation
    window.location.href = `confirmation.html?ref=${bookingRef}&status=submitted`;
  } catch (err) {
    console.error(err);
    showToast('Failed to submit payment. Try again.', 'error');
    document.getElementById('confirmCryptoBtn').disabled = false;
    document.getElementById('confirmCryptoBtn').textContent = "I've sent the payment — Confirm Booking";
  }
});

// ── Pay button (triggers error for non-crypto) ──
document.getElementById('payBtn').addEventListener('click', () => {
  if (!selectedMethod) { showToast('Please select a payment method.', 'error'); return; }
  // Validate fields
  if (!validatePassengerDetails()) return;
  // Show error for non-crypto methods
  document.getElementById('errorOverlay').classList.add('open');
});

window.closeError = function() {
  document.getElementById('errorOverlay').classList.remove('open');
};
document.getElementById('errorOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeError();
});

function validatePassengerDetails() {
  const first = document.getElementById('payFirst').value.trim();
  const last  = document.getElementById('payLast').value.trim();
  const email = document.getElementById('payEmail').value.trim();
  const phone = document.getElementById('payPhone').value.trim();
  if (!first || !last) { showToast('Please enter passenger name.', 'error'); return false; }
  if (!email)          { showToast('Please enter email.', 'error'); return false; }
  if (!phone)          { showToast('Please enter phone number.', 'error'); return false; }
  return true;
}

async function confirmBooking(method) {
  if (!validatePassengerDetails()) return;

  const btn = method === 'crypto'
    ? document.getElementById('confirmCryptoBtn')
    : document.getElementById('payBtn');
  btn.textContent = 'Processing…';
  btn.disabled = true;

  try {
    const bookingRef = await addDoc(collection(db, 'bookings'), {
      userId:    currentUser.uid,
      passenger: {
        firstName: document.getElementById('payFirst').value.trim(),
        lastName:  document.getElementById('payLast').value.trim(),
        email:     document.getElementById('payEmail').value.trim(),
        phone:     document.getElementById('payPhone').value.trim(),
      },
      flight: {
        from: flight.from, fromCity: flight.fromCity,
        to:   flight.to,   toCity:   flight.toCity,
        dep: flight.dep, arr: flight.arr, dur: flight.dur,
        airline: flight.airline, stops: flight.stops,
        departDate: flight.departDate, pax: flight.pax,
        cabinClass: flight.cabinClass,
      },
      payment: { method, amount: total, currency: 'USD' },
      status:    method === 'crypto' ? 'pending_payment' : 'confirmed',
      bookedAt:  serverTimestamp(),
      bookingRef: generateBookingRef(),
    });

    sessionStorage.setItem('bookingId', bookingRef.id);
    window.location.href = 'confirmation.html';
  } catch(e) {
    console.error('confirmBooking error:', e);
    const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
    if (isPerm) {
      showToast('Booking failed: Missing or insufficient permissions. Client writes are blocked by Firestore rules. Contact support@grandskyairways.com or enable client writes.', 'error');
      // keep button disabled to prevent repeated attempts
      btn.textContent = method === 'crypto' ? "Booking blocked" : 'Booking failed';
      btn.disabled = true;
    } else {
      btn.textContent = method === 'crypto' ? "I've sent the payment — Confirm Booking" : 'Pay Now';
      btn.disabled = false;
      showToast('Booking failed. Please try again.', 'error');
    }
  }
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = type ? `show ${type}` : 'show';
  setTimeout(() => { toast.className = toast.className.replace('show','').trim(); }, 4000);
}
