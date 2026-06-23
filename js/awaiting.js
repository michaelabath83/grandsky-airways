// Awaiting page — uses Supabase for booking status polling
import { supabase } from './supabase-config.js';

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
    // nothing in Supabase yet; poll for manual approval or wait
    showToast('Waiting for admin to process your pending booking locally.', '');
    return;
  }

  try {
    // Subscribe to booking updates via Supabase realtime
    supabase
      .channel(`booking:${bookingId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, payload => {
        const d = payload.new;
        document.getElementById('bkStatus').innerHTML = `<strong>Status:</strong> ${d.status}`;
        renderBookingDetails(d);
        if (d.status === BOOKING_STATUS.PAYMENT_APPROVED || d.status === BOOKING_STATUS.TICKET_SENT) {
          showTicket(d);
        }
      })
      .subscribe();
    // Initial fetch
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!error && data) {
      document.getElementById('bkStatus').innerHTML = `<strong>Status:</strong> ${data.status}`;
      renderBookingDetails(data);
      if (data.status === BOOKING_STATUS.PAYMENT_APPROVED || data.status === BOOKING_STATUS.TICKET_SENT) {
        showTicket(data);
      }
    }
  } catch (e) { console.error(e); showToast('Could not load booking status','error'); }
}

async function fallbackFetch(bookingId){
  try{
    const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (error || !data) return;
    document.getElementById('bkStatus').innerHTML = `<strong>Status:</strong> ${data.status}`;
    renderBookingDetails(data);
    if (data.status === BOOKING_STATUS.PAYMENT_APPROVED || data.status === BOOKING_STATUS.TICKET_SENT) showTicket(data);
  }catch(e){console.error(e);}
}

function renderBookingDetails(d){
  const el = document.getElementById('bkDetails');
  const passenger = d.passenger_first || d.passenger?.firstName || '';
  const lastName = d.passenger_last || d.passenger?.lastName || '';
  const fromCity = d.from_city || d.flight?.fromCity || d.flight?.from || '';
  const toCity = d.to_city || d.flight?.toCity || d.flight?.to || '';
  const amount = d.amount_due || d.payment?.amountDue || d.payment?.amount || '';
  el.innerHTML = `
    <div><strong>Passenger:</strong> ${passenger} ${lastName}</div>
    <div><strong>Route:</strong> ${fromCity} → ${toCity}</div>
    <div><strong>Amount Due:</strong> $${amount}</div>
  `;
}

function showTicket(d){
  document.getElementById('approvedPanel').style.display = 'block';
  const box = document.getElementById('ticketBox');
  const passenger_first = d.passenger_first || d.passenger?.firstName || '';
  const passenger_last = d.passenger_last || d.passenger?.lastName || '';
  const bookingRef = d.booking_ref || d.bookingRef || '';
  const fromCity = d.from_city || d.flight?.fromCity || d.flight?.from || '';
  const toCity = d.to_city || d.flight?.toCity || d.flight?.to || '';
  const departDate = d.depart_date || d.flight?.departDate || '';
  const dep = d.depart_time || d.flight?.dep || '';
  box.innerHTML = `
    <div><strong>Booking Ref:</strong> ${bookingRef}</div>
    <div><strong>Passenger:</strong> ${passenger_first} ${passenger_last}</div>
    <div><strong>Flight:</strong> ${fromCity} → ${toCity}</div>
    <div><strong>Depart:</strong> ${departDate} ${dep}</div>
  `;
  showToast('Payment approved — ticket issued', 'success');
}

init();
