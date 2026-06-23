// =============================================
// GrandSky Airways — Payment Page Logic (consolidated)
// =============================================

import supabase from './supabase-config.js';

let currentUser = null;
let selectedMethod = null;
// Booking status constants
const BOOKING_STATUS = {
  PENDING_PAYMENT:    'pending_payment',
  PAYMENT_SUBMITTED:  'payment_submitted',
  PAYMENT_APPROVED:   'payment_approved',
  TICKET_SENT:        'ticket_sent',
  PAYMENT_REJECTED:   'payment_rejected',
  CANCELLED:          'cancelled'
};

// Initialize Supabase auth and handle changes
async function initAuth() {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session || null;
    if (!session) {
      // Do not redirect immediately to login — show a small sign-in hint instead
      currentUser = null;
      try {
        const id = 'gs-signin-hint';
        if (!document.getElementById(id)) {
          const hint = document.createElement('div');
          hint.id = id;
          hint.style = 'background:#fff3cd;color:#856404;padding:12px;border:1px solid #ffeeba;border-radius:6px;margin:12px;max-width:680px;margin-left:auto;margin-right:auto;text-align:center;font-size:14px;';
          hint.innerHTML = `Please sign in to continue. <a href="login.html?redirect=payment.html" style="font-weight:600;color:#856404;text-decoration:underline">Sign in</a>`;
          const container = document.body.firstElementChild || document.body;
          container.parentNode.insertBefore(hint, container);
        }
      } catch(e) { console.warn('render signin hint failed', e); }
      return;
    }
    currentUser = session.user;
    // Prefill fields from user metadata when available
    try {
      const meta = currentUser.user_metadata || {};
      document.getElementById('payFirst').value  = meta.firstName || '';
      document.getElementById('payLast').value   = meta.lastName  || '';
      document.getElementById('payEmail').value  = currentUser.email || '';
      document.getElementById('payPhone').value  = meta.phone || '';
    } catch(e){}
  } catch (e) {
    console.error('initAuth failed', e);
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (!session) {
    // Clear current user; do not redirect — avoid loop with legacy Firebase auth during migration
    currentUser = null;
    return;
  }
  currentUser = session.user;
  try {
    const meta = currentUser.user_metadata || {};
    document.getElementById('payFirst').value  = meta.firstName || '';
    document.getElementById('payLast').value   = meta.lastName  || '';
    document.getElementById('payEmail').value  = currentUser.email || '';
    document.getElementById('payPhone').value  = meta.phone || '';
  } catch (e) {}
});
initAuth();

// instrumentation
if (!window.__lastErrors) window.__lastErrors = [];
window.addEventListener('error', e => { try { window.__lastErrors.push({type:'error', message: e.message, filename: e.filename, lineno: e.lineno}); } catch(_){} });
window.addEventListener('unhandledrejection', e => { try { window.__lastErrors.push({type:'unhandledrejection', reason: (e.reason && e.reason.message) || String(e.reason)}); } catch(_){} });

const FLIGHT_KEY = 'selectedFlight';
let flight = null;
let flightRaw = sessionStorage.getItem(FLIGHT_KEY) || localStorage.getItem(FLIGHT_KEY) || null;
if (!flightRaw) {
  try { if (typeof showToast === 'function') showToast('No flight selected. Redirecting to flights list…', 'error'); } catch (e){}
  setTimeout(() => { window.location.href = 'flights.html'; }, 1400);
} else {
  try {
    flight = JSON.parse(flightRaw);
  } catch (err) {
    console.error('Failed to parse selectedFlight JSON:', err, flightRaw);
    try { sessionStorage.removeItem(FLIGHT_KEY); localStorage.removeItem(FLIGHT_KEY); } catch(e){}
    try { if (typeof showToast === 'function') showToast('Corrupted flight selection. Redirecting to flights list…', 'error'); } catch (e){}
    setTimeout(() => { window.location.href = 'flights.html'; }, 1200);
  }
}

// If stored flight uses different keys (from flights.js), map them to expected names
function normalizeStoredFlight(f) {
  if (!f) return f;
  const normalized = Object.assign({}, f);
  // times
  if (!normalized.dep && (normalized.depTime || normalized.departTime)) normalized.dep = normalized.depTime || normalized.departTime;
  if (!normalized.arr && normalized.arrTime) normalized.arr = normalized.arrTime;
  if (!normalized.dur && (normalized.duration || normalized.dur)) normalized.dur = normalized.duration || normalized.dur;
  // price
  if (!normalized.price && (normalized.pricePer || normalized.pricePer)) normalized.price = normalized.pricePer;
  // airline
  if (typeof normalized.airline === 'string') normalized.airline = { name: normalized.airline, code: (normalized.airline||'GS').slice(0,2).toUpperCase() };
  return normalized;
}
flight = normalizeStoredFlight(flight);
// debug: surface loaded flight shape for troubleshooting
try { console.info('payment.js loaded selectedFlight:', flight); } catch (_) {}
if (!flight) {
  // show visible hint in the order summary area so user sees missing data
  const fsW = document.getElementById('flightSummary');
  if (fsW) fsW.innerHTML = '<div style="color:#b94a48;padding:12px;">No flight data loaded — please re-select a flight.</div>';
}

// Summary / pricing
const priceVal = flight && (flight.price || flight.pricePer || 0) ? Number(flight.price || flight.pricePer) : 0;
let taxes  = Math.round(priceVal * 0.13);
let total = Number(priceVal || 0) + Number(taxes || 0);
function formatUSD(v) { return `$${Number(v).toFixed(2)}`; }

function populateOrderSummary() {
  try {
    const fs = document.getElementById('flightSummary');
    const pb = document.getElementById('priceBreakdown');
    const baseFare = flight && (flight.price || flight.pricePer) ? Number(flight.price || flight.pricePer) : 0;
    const tax = Math.round(baseFare * 0.13);
    const grand = Number(baseFare) + Number(tax);

    if (fs) {
      const airlineText = flight && flight.airline ? (flight.airline.name || flight.airline) : '';
      fs.innerHTML = `\n        <div class="fs-row route"><strong>${flight?.from || ''} (${flight?.fromCity || ''}) → ${flight?.to || ''} (${flight?.toCity || ''})</strong></div>\n        <div class="fs-row meta">${airlineText} • ${flight?.cabinClass || ''} • ${flight?.departDate || ''}</div>\n        <div class="fs-row times">${flight?.dep || ''} → ${flight?.arr || ''} • ${flight?.dur || ''}</div>\n        <div class="fs-row pax">Passengers: ${flight?.pax || 1}</div>\n      `;
    }

    if (pb) {
      pb.innerHTML = `\n        <div class="pb-row"><span>Base fare</span><span>${formatUSD(baseFare)}</span></div>\n        <div class="pb-row"><span>Taxes & fees</span><span>${formatUSD(tax)}</span></div>\n        <div class="pb-row total"><strong>Total</strong><strong>${formatUSD(grand)}</strong></div>\n      `;
      total = grand; taxes = tax;
    }
  } catch (e) { console.error('populateOrderSummary failed', e); }
}

populateOrderSummary();

  // Debug panel (visible when URL has ?debug=1) — shows auth state, selectedFlight, recent errors
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('debug') === '1') {
      const panel = document.createElement('div');
      panel.id = 'gs-debug-panel';
      panel.style = 'position:fixed;right:12px;bottom:12px;z-index:9999;width:360px;max-height:520px;overflow:auto;background:#0b0b0b;color:#eee;padding:12px;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.6);font-size:13px;line-height:1.3';
      panel.innerHTML = `<div style="font-weight:700;margin-bottom:8px;">GrandSky Debug</div>
        <div id="gs-debug-auth">Auth: loading…</div>
        <div id="gs-debug-flight" style="margin-top:8px">Flight: loading…</div>
        <div id="gs-debug-errors" style="margin-top:8px">Errors: loading…</div>
        <div id="gs-debug-action" style="margin-top:10px"></div>
        <div id="gs-debug-result" style="margin-top:8px;color:#ffd;word-break:break-all"></div>`;
      document.body.appendChild(panel);

      // create test-write button
      const actionEl = document.getElementById('gs-debug-action');
      const btn = document.createElement('button');
      btn.textContent = 'Test: Write booking (debug)';
      btn.style = 'background:#1f6feb;color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer';
      actionEl.appendChild(btn);

      btn.addEventListener('click', async () => {
        const resultEl = document.getElementById('gs-debug-result');
        resultEl.textContent = 'Attempting write…';
        try {
              const testPayload = {
                userId: currentUser ? currentUser.id : null,
                flight: { from: flight?.from || 'TEST', to: flight?.to || 'TEST', dep: flight?.dep || '00:00' },
                payment: { method: 'debug', amount: 1.00 },
                status: 'debug_test', createdAt: new Date().toISOString()
              };
              try {
                const res = await callServer('/api/createBooking', testPayload);
                if (res && res.bookingId) {
                  resultEl.style.color = '#8df5a8';
                  resultEl.textContent = `Write successful — docId: ${res.bookingId}`;
                } else {
                  throw new Error('Server did not return bookingId');
                }
              } catch (se) {
                throw se;
              }
        } catch (err) {
          console.error('debug write failed', err);
          resultEl.style.color = '#f5a8a8';
          try { resultEl.textContent = `Write failed — ${err && err.message ? err.message : String(err)} | code: ${err && err.code ? err.code : 'n/a'}`; } catch(e){ resultEl.textContent = 'Write failed — see console'; }
        }
      });

      function updatePanel() {
        try {
          const authEl = document.getElementById('gs-debug-auth');
          const flightEl = document.getElementById('gs-debug-flight');
          const errEl = document.getElementById('gs-debug-errors');
          authEl.textContent = 'Auth: ' + (currentUser ? `${currentUser.id} (${currentUser.email||'no-email'})` : 'NOT AUTHENTICATED');
          flightEl.textContent = 'Flight: ' + (flight ? JSON.stringify(flight) : 'none');
          errEl.textContent = 'Errors: ' + (window.__lastErrors ? JSON.stringify(window.__lastErrors.slice(-8)) : 'none');
        } catch (e) { console.error('updatePanel failed', e); }
      }
      setTimeout(updatePanel, 400);
      setInterval(updatePanel, 2000);
    }
  } catch (e) { console.error('debug panel init failed', e); }

// Crypto UI
const WALLET_ADDRESSES = { BTC: 'bc1qnsgpucf288w053e43jl2sl7zahzzu02vt4tqru' };
const RATES = { BTC: 0.0000145 };
let currentCoin = 'BTC';
let qr = null;

function updateCryptoUI(coin) {
  const amount = (total * RATES[coin]).toFixed(coin === 'USDT' ? 2 : 6);
  const elAmount = document.getElementById('cryptoAmount'); if (elAmount) elAmount.textContent = `${amount} ${coin}`;
  const addr = WALLET_ADDRESSES[coin]; const elAddr = document.getElementById('walletAddr'); if (elAddr) elAddr.textContent = addr;
  try {
    const qrEl = document.getElementById('qrPlaceholder');
    if (qrEl) {
      qrEl.innerHTML = '';
      const staticImg = document.getElementById('qrImage');
      if (coin === 'BTC' && staticImg) {
        staticImg.style.display = 'block'; qrEl.appendChild(staticImg); return;
      }
      if (typeof QRCode !== 'undefined') qr = new QRCode(qrEl, { text: addr, width: 160, height: 160 });
    }
  } catch (e) { console.error('QR render failed', e); }
}

document.querySelectorAll('.crypto-tab').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('.crypto-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); currentCoin = tab.dataset.coin; updateCryptoUI(currentCoin); }));
updateCryptoUI('BTC');

let cryptoSecs = 15 * 60;
const cryptoExpEl = document.getElementById('cryptoExpiry');
setInterval(() => { const m = String(Math.floor(cryptoSecs/60)).padStart(2,'0'); const s = String(cryptoSecs%60).padStart(2,'0'); if (cryptoExpEl) cryptoExpEl.textContent = `${m}:${s}`; if (cryptoSecs>0) cryptoSecs--; }, 1000);

// copy address
document.getElementById('copyAddr')?.addEventListener('click', () => { const addr = WALLET_ADDRESSES[currentCoin]; navigator.clipboard.writeText(addr).then(() => { const btn = document.getElementById('copyAddr'); if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); } }).catch(err => { if (typeof showToast === 'function') showToast('Copy failed', 'error'); }); });

// Booking helpers
function showBookingRef(ref) { const el = document.getElementById('bookingRefDisplay'); const txt = document.getElementById('bookingRefText'); if (txt) txt.textContent = ref; if (el) el.style.display = 'block'; }
function showFirestoreRemediation() { try { const el = document.getElementById('firestoreRemediation'); if (!el) return; el.style.display = 'block'; try { document.getElementById('confirmCryptoBtn').disabled = true; } catch(_){} try { document.getElementById('payBtn').disabled = true; } catch(_){} } catch(e){console.error(e);} }
function generateBookingRef() { const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let s=''; for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return 'GSA-'+s; }

function validatePassengerDetails() {
  const first = document.getElementById('payFirst')?.value?.trim();
  const last  = document.getElementById('payLast')?.value?.trim();
  const email = document.getElementById('payEmail')?.value?.trim();
  const phone = document.getElementById('payPhone')?.value?.trim();
  if (!first || !last) { if (typeof showToast === 'function') showToast('Please enter passenger name.', 'error'); return false; }
  if (!email) { if (typeof showToast === 'function') showToast('Please enter email.', 'error'); return false; }
  if (!phone) { if (typeof showToast === 'function') showToast('Please enter phone number.', 'error'); return false; }
  return true;
}

// Helper: call serverless endpoint with ID token
async function callServer(path, body) {
  // ensure we have fresh Supabase access token
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch (e) { console.warn('getSession failed', e); }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  // If running locally (file served from localhost), point requests to the deployed Vercel domain
  let base = '';
  try {
    if (window.SERVER_API_BASE) base = window.SERVER_API_BASE;
    else if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') base = 'https://grandskyairways.com';
  } catch (e) { base = ''; }
  const url = base + path;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const txt = await res.text().catch(()=>null);
    const err = new Error(`Server ${path} failed: ${res.status} ${res.statusText} ${txt||''}`);
    err.status = res.status; err.body = txt;
    throw err;
  }
  return await res.json();
}

// Ensure booking creation when crypto panel opens
let ensureCryptoInFlight = false; let ensureCryptoPromise = null; let bookingInitFailed = false;
function ensureCryptoBooking() {
  if (ensureCryptoInFlight && ensureCryptoPromise) return ensureCryptoPromise;
  ensureCryptoInFlight = true;
  ensureCryptoPromise = (async () => {
    if (!currentUser) {
      const start = Date.now(); while (!currentUser && (Date.now()-start) < 3000) { await new Promise(r=>setTimeout(r,200)); }
      if (!currentUser) { bookingInitFailed = true; if (typeof showToast==='function') showToast('You must be signed in to create a booking.', 'error'); throw new Error('User not authenticated'); }
    }
    try {
      const existingBookingId = sessionStorage.getItem('bookingId');
      if (existingBookingId) {
        const br = sessionStorage.getItem('bookingRef');
        if (br) showBookingRef(br);
        return { id: existingBookingId, bookingRef: br };
      }

      const payload = {
        userId: currentUser? currentUser.id : null,
        passenger: {
          firstName: document.getElementById('payFirst')?.value?.trim() || '',
          lastName:  document.getElementById('payLast')?.value?.trim() || '',
          email:     document.getElementById('payEmail')?.value?.trim() || '',
          phone:     document.getElementById('payPhone')?.value?.trim() || ''
        },
        flight: {
          from: flight?.from, fromCity: flight?.fromCity, to: flight?.to, toCity: flight?.toCity,
          dep: flight?.dep, arr: flight?.arr, dur: flight?.dur,
          airline: flight?.airline, pax: flight?.pax, cabinClass: flight?.cabinClass, departDate: flight?.departDate
        },
        payment: { method: 'crypto', coin: currentCoin, walletAddress: WALLET_ADDRESSES[currentCoin], amount: total, cryptoAmount: (total * RATES[currentCoin]).toFixed(6) },
        status: BOOKING_STATUS.PENDING_PAYMENT,
        bookingRef: generateBookingRef()
      };

      // Create booking server-side only.
      const res = await callServer('/api/createBooking', payload);
      if (res && res.bookingId) {
        sessionStorage.setItem('bookingId', res.bookingId);
        sessionStorage.setItem('bookingRef', res.bookingRef || payload.bookingRef);
        showBookingRef(res.bookingRef || payload.bookingRef);
        return { id: res.bookingId, bookingRef: res.bookingRef || payload.bookingRef };
      }
      throw new Error('Server createBooking failed to return bookingId');
    } catch (err) {
      console.error('ensureCryptoBooking error:', err);
      bookingInitFailed = true;
      const msg = err && err.message ? err.message : 'Failed creating booking. Try again.';
      const isPerm = err && (err.code === 'permission-denied' || /permission/i.test(err.message));
      if (isPerm) { if (typeof showToast === 'function') showToast('Booking init failed: Missing or insufficient permissions. See remediation panel for next steps.', 'error'); try { showFirestoreRemediation(); } catch(_){} try { document.getElementById('confirmCryptoBtn').disabled = true; } catch(_){} try { document.getElementById('payBtn').disabled = true; } catch(_){} }
      else { if (typeof showToast === 'function') showToast(`Booking init failed: ${msg}`, 'error'); }
      throw err;
    } finally { ensureCryptoInFlight = false; ensureCryptoPromise = null; }
  })();
  return ensureCryptoPromise;
}

// Confirm crypto submission handler
document.getElementById('confirmCryptoBtn')?.addEventListener('click', async () => {
  if (!validatePassengerDetails()) return;
  try { if (!sessionStorage.getItem('bookingId') || !sessionStorage.getItem('bookingRef')) await ensureCryptoBooking(); } catch (err) { if (typeof showToast==='function') showToast('Booking initialization failed. Please reload and try again.', 'error'); return; }
  const bookingId = sessionStorage.getItem('bookingId'); const bookingRef = sessionStorage.getItem('bookingRef');
  if (!bookingId || !bookingRef) { if (typeof showToast==='function') showToast('Booking not found. Please reload.', 'error'); return; }
  const confirmMsg = `Please confirm you have sent the exact amount (${document.getElementById('cryptoAmount')?.textContent || ''}) to ${WALLET_ADDRESSES[currentCoin]}.\n\nClick OK to submit for review.`;
  if (!window.confirm(confirmMsg)) return;
  const btn = document.getElementById('confirmCryptoBtn'); if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  try {
    const paymentPayload = { bookingId, bookingRef, coin: currentCoin, walletAddress: WALLET_ADDRESSES[currentCoin], cryptoAmount: (total * RATES[currentCoin]).toFixed(currentCoin === 'USDT' ? 2 : 6), amountUSD: total };
    // Submit payment server-side only
    await callServer('/api/submitPayment', paymentPayload);
  } catch (e) {
    console.error('submitPayment failed', e);
    const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
    if (isPerm) { if (typeof showToast === 'function') showToast('Failed to submit payment: insufficient permissions.', 'error'); try { showFirestoreRemediation(); } catch(_){} }
    else if (typeof showToast === 'function') showToast('Failed to submit payment. Try again.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = "I've sent the payment — Confirm Booking"; }
    return;
  }
  window.location.href = `confirmation.html?ref=${bookingRef}&status=submitted`;
});

// General confirm booking function (used by non-crypto flows)
async function confirmBooking(method) {
  if (!validatePassengerDetails()) return;
  const btn = method === 'crypto' ? document.getElementById('confirmCryptoBtn') : document.getElementById('payBtn');
  if (btn) { btn.textContent = 'Processing…'; btn.disabled = true; }
  try {
    const payload = {
      userId: currentUser?currentUser.id:null,
      passenger: { firstName: document.getElementById('payFirst')?.value?.trim() || '', lastName: document.getElementById('payLast')?.value?.trim() || '', email: document.getElementById('payEmail')?.value?.trim() || '', phone: document.getElementById('payPhone')?.value?.trim() || '' },
      flight: { from: flight?.from, fromCity: flight?.fromCity, to: flight?.to, toCity: flight?.toCity, dep: flight?.dep, arr: flight?.arr, dur: flight?.dur, airline: flight?.airline, stops: flight?.stops, departDate: flight?.departDate, pax: flight?.pax, cabinClass: flight?.cabinClass },
      payment: { method, amount: total, currency: 'USD' },
      status: method === 'crypto' ? BOOKING_STATUS.PENDING_PAYMENT : 'confirmed',
      bookingRef: generateBookingRef()
    };

    // create booking via server
    const res = await callServer('/api/createBooking', payload);
    if (!res || !res.bookingId) throw new Error('createBooking failed');
    sessionStorage.setItem('bookingId', res.bookingId); sessionStorage.setItem('bookingRef', payload.bookingRef);

    if (method === 'crypto') {
      try {
        await callServer('/api/submitPayment', { bookingId: res.bookingId, bookingRef: payload.bookingRef, coin: currentCoin, walletAddress: WALLET_ADDRESSES[currentCoin], cryptoAmount: (total * RATES[currentCoin]).toFixed(6), amountUSD: total });
      } catch (e) { console.error('confirmBooking submitPayment failed:', e); try { showFirestoreRemediation(); } catch(_){} }
      window.location.href = 'awaiting.html'; return;
    }

    window.location.href = 'confirmation.html';
  } catch (e) {
    console.error('confirmBooking error:', e);
    const isPerm = e && (e.code === 'permission-denied' || /permission/i.test(e.message));
    if (isPerm) { if (typeof showToast === 'function') showToast('Booking failed: Missing or insufficient permissions. See remediation panel for next steps.', 'error'); try { showFirestoreRemediation(); } catch(_){} if (btn) { btn.textContent = method === 'crypto' ? "Booking blocked" : 'Booking failed'; btn.disabled = true; } }
    else { if (btn) { btn.textContent = method === 'crypto' ? "I've sent the payment — Confirm Booking" : 'Pay Now'; btn.disabled = false; } if (typeof showToast === 'function') showToast('Booking failed. Please try again.', 'error'); }
  }
}

// expose confirmBooking and wire method cards
try {
  window.confirmBooking = confirmBooking;
  function wireMethodCards() {
    try {
      const cards = document.querySelectorAll('.method-card');
      cards.forEach(card => {
        if (card.__wired) return; card.__wired = true;
        card.addEventListener('click', async () => {
          document.querySelectorAll('.method-card').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected'); selectedMethod = card.dataset.method;
          const cryptoPanel = document.getElementById('cryptoPanel'); const payBtn = document.getElementById('payBtn');
          if (selectedMethod === 'crypto') { cryptoPanel?.classList.add('open'); try { document.getElementById('confirmCryptoBtn').disabled = true; await ensureCryptoBooking(); } catch(e){} finally { try{document.getElementById('confirmCryptoBtn').disabled=false;}catch(e){} } if (payBtn) payBtn.style.display = 'none'; }
          else { cryptoPanel?.classList.remove('open'); if (payBtn) payBtn.style.display = 'block'; }
        });
      });
    } catch (e) { console.error('wireMethodCards failed', e); }
  }
  wireMethodCards(); document.addEventListener('DOMContentLoaded', wireMethodCards);
} catch (e) { console.error('expose confirmBooking failed', e); }

// wire pay button to show error overlay for non-crypto
document.getElementById('payBtn')?.addEventListener('click', () => { if (!selectedMethod) { if (typeof showToast === 'function') showToast('Please select a payment method.', 'error'); return; } if (!validatePassengerDetails()) return; document.getElementById('errorOverlay')?.classList.add('open'); });
window.closeError = function() { document.getElementById('errorOverlay')?.classList.remove('open'); };
document.getElementById('errorOverlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeError(); });

// done
