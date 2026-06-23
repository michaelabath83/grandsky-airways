// =============================================
// GrandSky Airways — Payment Page Logic
// =============================================

// Firebase usage commented out in backup file — auth migrated to Supabase.
// TODO: migrate this backup script to Supabase or serverless endpoints.
// import { auth, db } from './firebase-config.js';
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// import { doc, getDoc, addDoc, collection, serverTimestamp, updateDoc, setDoc }
//   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// Using Vercel serverless endpoints instead of Firebase callables

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

// Error instrumentation for diagnostics
if (!window.__lastErrors) window.__lastErrors = [];
window.addEventListener('error', e => { try { window.__lastErrors.push({type:'error', message: e.message, filename: e.filename, lineno: e.lineno}); } catch(_){} });
window.addEventListener('unhandledrejection', e => { try { window.__lastErrors.push({type:'unhandledrejection', reason: (e.reason && e.reason.message) || String(e.reason)}); } catch(_){} });

// Load flight data
// Flight storage key
const FLIGHT_KEY = 'selectedFlight';

// Load selected flight from sessionStorage; fall back to localStorage.
let flight = null;
let flightRaw = sessionStorage.getItem(FLIGHT_KEY) || localStorage.getItem(FLIGHT_KEY) || null;
if (!flightRaw) {
  try { showToast('No flight selected. Redirecting to flights list…', 'error'); } catch (e) {}
  setTimeout(() => { window.location.href = 'flights.html'; }, 1400);
} else {
  try {
    flight = JSON.parse(flightRaw);
  } catch (err) {
    console.error('Failed to parse selectedFlight JSON:', err, flightRaw);
    // Remove corrupt entries and redirect user to re-select
    try { sessionStorage.removeItem(FLIGHT_KEY); localStorage.removeItem(FLIGHT_KEY); } catch(e){}
    try { showToast('Corrupted flight selection. Redirecting to flights list…', 'error'); } catch (e){}
    setTimeout(() => { window.location.href = 'flights.html'; }, 1200);
  }
}

// Populate order summary (use safe numeric conversions)
const priceVal = flight && flight.price ? Number(flight.price) : 0;
const taxes  = Math.round(priceVal * 0.13);
// total (USD) shown in order summary and used by crypto calculations
let total = Number(priceVal || 0) + Number(taxes || 0);

function formatUSD(v) { return `$${Number(v).toFixed(2)}`; }

function populateOrderSummary() {
  try {
    const fs = document.getElementById('flightSummary');
    const pb = document.getElementById('priceBreakdown');
    if (fs) {
      fs.innerHTML = `
        <div class="fs-row"><strong>${flight.from} → ${flight.to}</strong></div>
        <div class="fs-row">${flight.airline || ''} • ${flight.cabinClass || ''} • ${flight.departDate || ''}</div>
      `;
    }
    if (pb) {
      pb.innerHTML = `
        <div class="pb-row"><span>Subtotal</span><span>${formatUSD(flight.price)}</span></div>
        <div class="pb-row"><span>Taxes & fees</span><span>${formatUSD(taxes)}</span></div>
        <div class="pb-row total"><strong>Total</strong><strong>${formatUSD(total)}</strong></div>
      `;
    }
  } catch (e) { console.error('populateOrderSummary failed', e); }
}

populateOrderSummary();

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

      // generate booking via server endpoint (Vercel)
      const payload = {
        passenger: {
          firstName: document.getElementById('payFirst').value.trim(),
          lastName:  document.getElementById('payLast').value.trim(),
          email:     document.getElementById('payEmail').value.trim(),
          phone:     document.getElementById('payPhone').value.trim(),
        },
        flight: {
          from: flight.from, to: flight.to, departDate: flight.departDate,
          dep: flight.dep, arr: flight.arr, airline: flight.airline, pax: flight.pax, cabinClass: flight.cabinClass
        },
        payment: {
          method: 'crypto', coin: currentCoin, walletAddress: WALLET_ADDRESSES[currentCoin],
          amount: total, cryptoAmount: (total * RATES[currentCoin]).toFixed(6)
        },
        status: BOOKING_STATUS.PENDING_PAYMENT
      };
      // call server endpoint
      try {
        const idToken = currentUser ? await currentUser.getIdToken() : null;
        const res = await fetch('/api/createBooking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': idToken ? `Bearer ${idToken}` : ''
          },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (res.ok && result.bookingId) {
          sessionStorage.setItem('bookingId', result.bookingId);
          sessionStorage.setItem('bookingRef', result.bookingRef);
          showBookingRef(result.bookingRef);
          return { id: result.bookingId, bookingRef: result.bookingRef };
        }
        const msg = result && result.error ? result.error : 'createBooking failed';
        throw new Error(msg);
      } catch (e) {
        throw e;
      }
    } catch (err) {
      console.error('ensureCryptoBooking error:', err);
      bookingInitFailed = true;
      const msg = err && err.message ? err.message : 'Failed creating booking. Try again.';
      // Detect permission errors and provide actionable guidance
      const isPerm = err && (err.code === 'permission-denied' || /permission/i.test(err.message));
      if (isPerm) {
        showToast('Booking init failed: Missing or insufficient permissions. See remediation panel for next steps.', 'error');
        // reveal remediation panel and disable action buttons
        try { showFirestoreRemediation(); } catch(e){}
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

function showFirestoreRemediation() {
  try {
    const el = document.getElementById('firestoreRemediation');
    if (!el) return;
    el.style.display = 'block';
    // ensure buttons are visible/disabled as needed
    try { document.getElementById('confirmCryptoBtn').disabled = true; } catch(e){}
    try { document.getElementById('payBtn').disabled = true; } catch(e){}
  } catch (e) { console.error('showFirestoreRemediation failed', e); }
}

function generateBookingRef() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return 'GSA-' + s;
}

// attach handler for confirm (user clicked "I've sent the payment")
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

    const confirmMsg = `Please confirm you have sent the exact amount (${document.getElementById('cryptoAmount').textContent}) to ${WALLET_ADDRESSES[currentCoin]}.

Click OK to submit for review.`;
    if (!window.confirm(confirmMsg)) return;

    const btn = document.getElementById('confirmCryptoBtn');
    btn.disabled = true; btn.textContent = 'Submitting…';

    // submit payment via server-side endpoint
    try {
      const idToken = currentUser ? await currentUser.getIdToken() : null;
      const res = await fetch('/api/submitPayment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken ? `Bearer ${idToken}` : ''
        },
        body: JSON.stringify({
          bookingId,
          coin: currentCoin,
          walletAddress: WALLET_ADDRESSES[currentCoin],
          cryptoAmount: (total * RATES[currentCoin]).toFixed(currentCoin === 'USDT' ? 2 : 6),
          amountUSD: total
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(()=>({}));
        throw new Error(errBody.error || 'submitPayment failed');
      }
    } catch (e) {
      console.error('submitPayment endpoint failed', e);
      const errMsg = e && e.message ? e.message : '';
      const isPerm = /permission|auth/i.test(errMsg);
      if (isPerm) {
        showToast('Failed to submit payment: insufficient permissions.', 'error');
        try { showFirestoreRemediation(); } catch(err){}
      } else {
        showToast('Failed to submit payment. Try again.', 'error');
      }
    }

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


// Make `confirmBooking` available to inline handlers and ensure method cards are wired
try {
  window.confirmBooking = confirmBooking;

  function wireMethodCards() {
    try {
      const cards = document.querySelectorAll('.method-card');
      cards.forEach(card => {
        // Avoid attaching duplicate listeners
        if (card.__wired) return; card.__wired = true;
        card.addEventListener('click', async () => {
          document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedMethod = card.dataset.method;
          const cryptoPanel = document.getElementById('cryptoPanel');
          const payBtn = document.getElementById('payBtn');
          if (selectedMethod === 'crypto') {
            cryptoPanel.classList.add('open');
            try { document.getElementById('confirmCryptoBtn').disabled = true; await ensureCryptoBooking(); } catch(e){} finally { try{document.getElementById('confirmCryptoBtn').disabled=false;}catch(e){} }
            if (payBtn) payBtn.style.display = 'none';
          } else {
            if (cryptoPanel) cryptoPanel.classList.remove('open');
            if (payBtn) payBtn.style.display = 'block';
          }
        });
      });
    } catch (e) { console.error('wireMethodCards failed', e); }
  }

  // run now and also when DOM ready
  wireMethodCards();
  document.addEventListener('DOMContentLoaded', wireMethodCards);
} catch (e) { console.error('expose confirmBooking failed', e); }
  try {
    const payload = {
      userId:    currentUser ? currentUser.uid : null,
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
      status:    method === 'crypto' ? BOOKING_STATUS.PENDING_PAYMENT : 'confirmed',
      bookedAt:  serverTimestamp(),
      bookingRef: generateBookingRef(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // attempt to create booking in Firestore
    let docRef;
    try {
      docRef = await addDoc(collection(db, 'bookings'), payload);
      sessionStorage.setItem('bookingId', docRef.id);
      sessionStorage.setItem('bookingRef', payload.bookingRef);
    } catch (e) {
      console.error('confirmBooking addDoc failed:', e);
      const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
      if (isPerm) {
        // fallback: store booking data locally and send user to awaiting page
        sessionStorage.setItem('bookingLocalPayload', JSON.stringify(payload));
        sessionStorage.setItem('bookingRef', payload.bookingRef);
        try { showFirestoreRemediation(); } catch(err){}
        window.location.href = 'awaiting.html';
        return;
      }
      throw e;
    }

    // for crypto, mark as submitted, create payment and notify admin, then show awaiting page
    if (method === 'crypto') {
      try {
        const idToken = currentUser ? await currentUser.getIdToken() : null;
        const res = await fetch('/api/submitPayment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': idToken ? `Bearer ${idToken}` : ''
          },
          body: JSON.stringify({ bookingId: docRef.id, coin: currentCoin, walletAddress: WALLET_ADDRESSES[currentCoin], cryptoAmount: (total * RATES[currentCoin]).toFixed(6), amountUSD: total })
        });
        if (!res.ok) {
          const errBody = await res.json().catch(()=>({}));
          throw new Error(errBody.error || 'submitPayment failed');
        }
      } catch (e) {
        console.error('confirmBooking submitPayment failed:', e);
        const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
        if (isPerm) { try { showFirestoreRemediation(); } catch(err){} }
      }

      window.location.href = 'awaiting.html';
      return;
    }

    // non-crypto -> confirmation
    window.location.href = 'confirmation.html';
  } catch(e) {
    console.error('confirmBooking error:', e);
    const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
    if (isPerm) {
      showToast('Booking failed: Missing or insufficient permissions. See remediation panel for next steps.', 'error');
      try { showFirestoreRemediation(); } catch(e){}
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
