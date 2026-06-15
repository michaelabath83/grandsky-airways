import { db } from './firebase-config.js';
import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const BOOKING_STATUS = {
  PAYMENT_SUBMITTED:  'payment_submitted',
  PAYMENT_APPROVED:   'payment_approved',
  TICKET_SENT:        'ticket_sent'
};

function showToast(msg, type=''){
  const t = document.getElementById('toast'); t.textContent = msg; t.className = type?`show ${type}`:'show'; setTimeout(()=>t.className=t.className.replace('show','').trim(),4000);
}

async function init() {
  // booking id precedence: sessionStorage.bookingId, then local payload bookingRef
  let bookingId = sessionStorage.getItem('bookingId');
  const bookingRef = sessionStorage.getItem('bookingRef') || (JSON.parse(sessionStorage.getItem('bookingLocalPayload')||'{}').bookingRef);
  document.getElementById('bkRef').textContent = bookingRef || '—';

  if (!bookingId) {
    // nothing in Firestore yet; poll for manual approval or wait
    showToast('Waiting for admin to process your pending booking locally.', '');
    return;
  }

  const docRef = doc(db, 'bookings', bookingId);
  try {
    // real-time listener
    onSnapshot(docRef, snap => {
      if (!snap.exists()) return;
      const d = snap.data();
      const status = d.status;
      document.getElementById('bkStatus').innerHTML = `<strong>Status:</strong> ${status}`;
      renderBookingDetails(d);
      if (status === BOOKING_STATUS.PAYMENT_APPROVED || status === BOOKING_STATUS.TICKET_SENT) {
        showTicket(d);
      }
    }, err => { console.error('awaiting onSnapshot', err); showToast('Realtime error — trying static refresh','error'); fallbackFetch(docRef); });
  } catch (e) { console.error(e); fallbackFetch(docRef); }
}

async function fallbackFetch(docRef){
  try{
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;
    const d = snap.data();
    document.getElementById('bkStatus').innerHTML = `<strong>Status:</strong> ${d.status}`;
    renderBookingDetails(d);
    if (d.status === BOOKING_STATUS.PAYMENT_APPROVED || d.status === BOOKING_STATUS.TICKET_SENT) showTicket(d);
  }catch(e){console.error(e);}
}

function renderBookingDetails(d){
  const el = document.getElementById('bkDetails');
  el.innerHTML = `
    <div><strong>Passenger:</strong> ${d.passenger?.firstName||''} ${d.passenger?.lastName||''}</div>
    <div><strong>Route:</strong> ${d.flight?.fromCity||d.flight?.from} → ${d.flight?.toCity||d.flight?.to}</div>
    <div><strong>Amount Due:</strong> $${d.payment?.amountDue||d.payment?.amount||''}</div>
  `;
}

function showTicket(d){
  document.getElementById('approvedPanel').style.display = 'block';
  const box = document.getElementById('ticketBox');
  box.innerHTML = `
    <div><strong>Booking Ref:</strong> ${d.bookingRef}</div>
    <div><strong>Passenger:</strong> ${d.passenger.firstName} ${d.passenger.lastName}</div>
    <div><strong>Flight:</strong> ${d.flight.fromCity||d.flight.from} → ${d.flight.toCity||d.flight.to}</div>
    <div><strong>Depart:</strong> ${d.flight.departDate} ${d.flight.dep}</div>
  `;
  showToast('Payment approved — ticket issued', 'success');
}

init();
