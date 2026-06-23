// Admin panel logic — Supabase version
import { supabase, ADMIN_EMAILS } from './supabase-config.js';

const BOOKING_STATUS = {
  PENDING_PAYMENT:    'pending_payment',
  PAYMENT_SUBMITTED:  'payment_submitted',
  PAYMENT_APPROVED:   'payment_approved',
  TICKET_SENT:        'ticket_sent',
  PAYMENT_REJECTED:   'payment_rejected',
  CANCELLED:          'cancelled'
};

// Guard admin access (Supabase)
(async () => {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !ADMIN_EMAILS.includes(user?.email)) {
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  initAdmin();
})();
supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user || null;
  if (!user || !ADMIN_EMAILS.includes(user?.email)) {
    window.location.href = 'login.html';
  }
});

// Error instrumentation
if (!window.__lastErrors) window.__lastErrors = [];
window.addEventListener('error', e => { try { window.__lastErrors.push({type:'error', message:e.message, filename:e.filename, lineno:e.lineno}); } catch(_){} });
window.addEventListener('unhandledrejection', e => { try { window.__lastErrors.push({type:'unhandledrejection', reason:(e.reason && e.reason.message) || String(e.reason)}); } catch(_){} });

document.getElementById('adminSignOut').addEventListener('click', async () => {
  await supabase.auth.signOut(); window.location.href = '../index.html';
});

async function initAdmin() {
  loadStats();
  setupFlightsManager();
  loadAirports();
  loadAirlines();
  loadBookings();
  loadUsers();
  attachImportHandlers();
  setupPendingPayments();
}

// ----- Stats -----
async function loadStats() {
  try {
    const bRes = await supabase.from('bookings').select('*', { count: 'exact' }).range(0, 0);
    const uRes = await supabase.from('profiles').select('*', { count: 'exact' }).range(0, 0);
    const fRes = await supabase.from('flights').select('*', { count: 'exact' }).range(0, 0);
    
    document.getElementById('statBookings').querySelector('.val').textContent = bRes.count || 0;
    document.getElementById('statUsers').querySelector('.val').textContent = uRes.count || 0;
    document.getElementById('statRoutes').querySelector('.val').textContent = fRes.count || 0;

    // revenue
    let revenue = 0;
    const payments = await supabase.from('payments').select('amount_usd');
    if (!payments.error && payments.data) {
      revenue = payments.data.reduce((sum, p) => sum + Number(p.amount_usd || 0), 0);
    }
    document.getElementById('statRevenue').querySelector('.val').textContent = '$' + revenue.toFixed(2);
  } catch(e) { console.error(e); showToast('Could not load stats', 'error'); }
}

// ----- Flights Manager -----
function setupFlightsManager() {
  const wrap = document.getElementById('flightsTableWrap');
  
  // Real-time subscription via Supabase
  const sub = supabase
    .channel('flights')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'flights' }, payload => {
      loadFlightsList();
    })
    .subscribe();

  // Initial load
  loadFlightsList();
  
  document.getElementById('addRouteBtn').addEventListener('click', () => openFlightModal());

  function loadFlightsList() {
    supabase.from('flights').select('*').then(({ data, error }) => {
      if (error) {
        console.error('Flights load error', error);
        showToast('Could not load flights', 'error');
        return;
      }
      renderFlightsTable(data || []);
    });
  }
}

function renderFlightsTable(rows) {
  const wrap = document.getElementById('flightsTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No routes</div>'; return; }
  const t = document.createElement('table'); t.className = 'table';
  t.innerHTML = `<thead><tr><th>From</th><th>To</th><th>Airline</th><th>Price</th><th>Stops</th><th>Featured</th><th>Actions</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.from_city} (${r.from_code})</td>
      <td>${r.to_city} (${r.to_code})</td>
      <td>${r.airline||''}</td>
      <td>$${r.price||''}</td>
      <td>${r.stops||0}</td>
      <td>${r.featured? 'Yes' : 'No'}</td>
      <td class="actions">
        <button data-id="${r.id}" class="editBtn"><i class="bi bi-pencil"></i></button>
        <button data-id="${r.id}" class="delBtn"><i class="bi bi-trash"></i></button>
      </td>
    `;
    body.appendChild(tr);
  });
  t.appendChild(body);
  wrap.innerHTML = ''; wrap.appendChild(t);

  wrap.querySelectorAll('.editBtn').forEach(b => b.addEventListener('click', e => openFlightModal(b.dataset.id)));
  wrap.querySelectorAll('.delBtn').forEach(b => b.addEventListener('click', async e => {
    if (!confirm('Delete this route?')) return;
    try { 
      await supabase.from('flights').delete().eq('id', b.dataset.id); 
      showToast('Route deleted', 'success'); 
    } catch(e){ showToast('Delete failed','error'); }
  }));
}

// Modal
function openFlightModal(id) {
  let modal = document.getElementById('flightModal');
  if (!modal) {
    modal = document.createElement('div'); modal.className = 'modal'; modal.id = 'flightModal';
    modal.innerHTML = `
      <div class="card">
        <h3 id="modalTitle">Route</h3>
        <div class="form-row">
          <div class="form-group"><label>From</label><input id="f_from" class="form-input"/></div>
          <div class="form-group"><label>To</label><input id="f_to" class="form-input"/></div>
          <div class="form-group"><label>Price</label><input id="f_price" type="number" class="form-input"/></div>
          <div class="form-group"><label>Airline</label><input id="f_airline" class="form-input"/></div>
          <div class="form-group"><label>Dep</label><input id="f_dep" type="time" class="form-input"/></div>
          <div class="form-group"><label>Arr</label><input id="f_arr" type="time" class="form-input"/></div>
          <div class="form-group"><label>Duration</label><input id="f_dur" class="form-input"/></div>
          <div class="form-group"><label>Stops</label>
            <select id="f_stops" class="form-input"><option value="0">Nonstop</option><option value="1">1 Stop</option><option value="2">2+ Stops</option></select>
          </div>
          <div class="form-group"><label>Featured</label><input id="f_featured" type="checkbox"/></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px"><button id="saveRoute" class="nav-cta">Save</button><button id="cancelRoute" class="btn-obsidian">Cancel</button></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#cancelRoute').addEventListener('click', () => modal.classList.remove('open'));
  }
  modal.classList.add('open');

  if (!id) {
    modal.querySelector('#modalTitle').textContent = 'Add Route';
    fillModalFields({});
    modal.querySelector('#saveRoute').onclick = async () => { await saveRoute(); modal.classList.remove('open'); };
  } else {
    modal.querySelector('#modalTitle').textContent = 'Edit Route';
    // load flight
    supabase.from('flights').select('*').eq('id', id).single().then(({data, error}) => {
      if (!error && data) fillModalFields(data);
    });
    modal.querySelector('#saveRoute').onclick = async () => { await saveRoute(id); modal.classList.remove('open'); };
  }
}

function fillModalFields(d) {
  document.getElementById('f_from').value = d.from_city ? `${d.from_city} (${d.from_code||''})` : '';
  document.getElementById('f_to').value = d.to_city ? `${d.to_city} (${d.to_code||''})` : '';
  document.getElementById('f_price').value = d.price || '';
  document.getElementById('f_airline').value = d.airline || '';
  document.getElementById('f_dep').value = d.dep || '';
  document.getElementById('f_arr').value = d.arr || '';
  document.getElementById('f_dur').value = d.duration || '';
  document.getElementById('f_stops').value = d.stops || 0;
  document.getElementById('f_featured').checked = !!d.featured;
}

async function saveRoute(id) {
  const payload = {
    from_city: parseCity(document.getElementById('f_from').value).city,
    from_code: parseCity(document.getElementById('f_from').value).code,
    to_city: parseCity(document.getElementById('f_to').value).city,
    to_code: parseCity(document.getElementById('f_to').value).code,
    price: Number(document.getElementById('f_price').value)||0,
    airline: document.getElementById('f_airline').value,
    dep: document.getElementById('f_dep').value,
    arr: document.getElementById('f_arr').value,
    duration: document.getElementById('f_dur').value,
    stops: Number(document.getElementById('f_stops').value),
    featured: document.getElementById('f_featured').checked
  };
  try {
    if (id) {
      await supabase.from('flights').update(payload).eq('id', id);
      showToast('Route updated','success');
    } else {
      await supabase.from('flights').insert([payload]);
      showToast('Route added','success');
    }
  } catch(e) { showToast('Save failed','error'); }
}

function parseCity(val) {
  const m = (val||'').match(/^(.*)\s*\(([^)]+)\)\s*$/);
  if (m) return { city: m[1].trim(), code: m[2].trim() };
  return { city: val, code: '' };
}

// ----- Airports -----
function loadAirports() {
  const wrap = document.getElementById('airportsTableWrap');
  supabase.from('airports').select('*').then(({ data, error }) => {
    if (error) {
      console.error('airports load error', error);
      return;
    }
    renderGenericTable(wrap, data || [], ['code','city','country','name','region'], 'airports');
  });
}

// ----- Airlines -----
function loadAirlines() {
  const wrap = document.getElementById('airlinesTableWrap');
  supabase.from('airlines').select('*').then(({ data, error }) => {
    if (error) {
      console.error('airlines load error', error);
      return;
    }
    renderGenericTable(wrap, data || [], ['code','name','color'], 'airlines');
  });
}

// ----- Import / Refresh helpers -----
function attachImportHandlers() {
  // Flights
  document.getElementById('importFlightsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToTable('flights', f);
    e.target.value = '';
  });
  document.getElementById('refreshFlights')?.addEventListener('click', async () => {
    const { data } = await supabase.from('flights').select('*');
    renderFlightsTable(data || []);
  });

  // Airports
  document.getElementById('importAirportsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToTable('airports', f); e.target.value = '';
  });
  document.getElementById('refreshAirports')?.addEventListener('click', async () => {
    const { data } = await supabase.from('airports').select('*');
    renderGenericTable(document.getElementById('airportsTableWrap'), data || [], ['code','city','country','name','region'], 'airports');
  });

  // Airlines
  document.getElementById('importAirlinesInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToTable('airlines', f); e.target.value = '';
  });
  document.getElementById('refreshAirlines')?.addEventListener('click', async () => {
    const { data } = await supabase.from('airlines').select('*');
    renderGenericTable(document.getElementById('airlinesTableWrap'), data || [], ['code','name','color'], 'airlines');
  });

  // Bookings
  document.getElementById('importBookingsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToTable('bookings', f); e.target.value = '';
  });
  document.getElementById('refreshBookings')?.addEventListener('click', async () => {
    const { data } = await supabase.from('bookings').select('*');
    renderBookingsTable(data || []);
  });

  // Users (profiles)
  document.getElementById('importUsersInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToTable('profiles', f); e.target.value = '';
  });
  document.getElementById('refreshUsers')?.addEventListener('click', async () => {
    const { data } = await supabase.from('profiles').select('*');
    renderUsersTable(data || []);
  });
}

async function importJsonToTable(tableName, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const rows = JSON.parse(evt.target.result);
        const arr = Array.isArray(rows) ? rows : [rows];
        const { error } = await supabase.from(tableName).insert(arr);
        if (error) throw error;
        showToast(`${arr.length} rows imported`, 'success');
        resolve();
      } catch (e) {
        showToast('Import failed: ' + e.message, 'error');
        reject(e);
      }
    };
    reader.readAsText(file);
  });
}

// ----- Bookings -----
function loadBookings() {
  const wrap = document.getElementById('bookingsTableWrap');
  supabase.from('bookings').select('*').then(({ data, error }) => {
    if (error) {
      console.error('bookings load error', error);
      return;
    }
    renderBookingsTable(data || []);
  });
}

function renderBookingsTable(rows) {
  const wrap = document.getElementById('bookingsTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No bookings</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  t.innerHTML = `<thead><tr><th>Ref</th><th>Passenger</th><th>Route</th><th>Date</th><th>Class</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const flight = r.flight_json || {};
    tr.innerHTML = `
      <td>${r.booking_ref||r.id}</td>
      <td>${(r.passenger_first||'') + ' ' + (r.passenger_last||'')}</td>
      <td>${flight.fromCity||''} → ${flight.toCity||''}</td>
      <td>${flight.departDate||''}</td>
      <td>${flight.cabinClass||''}</td>
      <td>Crypto</td>
      <td>$${flight.price||0}</td>
      <td>${r.status||''}</td>
      <td><button class="review-btn" data-id="${r.id}">Review</button></td>
    `;
    body.appendChild(tr);
  });
  t.appendChild(body);
  wrap.innerHTML=''; wrap.appendChild(t);

  wrap.querySelectorAll('.review-btn').forEach(b => b.addEventListener('click', e => openReviewPanel(b.dataset.id)));
}

async function openReviewPanel(bookingId) {
  const { data: booking, error } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
  if (error || !booking) return showToast('Booking not found','error');

  let panel = document.getElementById('reviewPanel');
  if (!panel) {
    panel = document.createElement('div'); panel.id='reviewPanel'; panel.className='slide-panel';
    panel.innerHTML = `<div class="panel-card"><div id="reviewContent"></div><div style="display:flex;gap:8px;margin-top:12px"><button id="approveBtn" class="nav-cta"><i class="bi bi-check-circle-fill"></i> Approve Payment</button><button id="rejectBtn" class="btn-danger"><i class="bi bi-x-circle-fill"></i> Reject Payment</button><button id="closeReview" class="btn-ghost">Close</button></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#closeReview').addEventListener('click', () => panel.classList.remove('open'));
  }
  document.getElementById('reviewContent').innerHTML = `
    <h3>${booking.booking_ref}</h3>
    <div><strong>Passenger:</strong> ${booking.passenger_first} ${booking.passenger_last}</div>
    <div><strong>Email:</strong> ${booking.passenger_email}</div>
    <div><strong>Phone:</strong> ${booking.passenger_phone}</div>
  `;
  panel.classList.add('open');

  document.getElementById('approveBtn').onclick = async () => {
    if (!confirm(`Approve payment for ${booking.booking_ref}? This will generate and email the ticket.`)) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/approvePayment', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ bookingId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Approve failed');
      showToast(`✓ Payment approved. Ticket sent.`,'success');
      panel.classList.remove('open');
    } catch (err) { showToast(err.message||'Approve failed','error'); }
  };

  document.getElementById('rejectBtn').onclick = async () => {
    const reason = prompt('Enter rejection reason (required)');
    if (!reason) return showToast('Rejection reason required','error');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/rejectPayment', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ bookingId, reason }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Reject failed');
      showToast('Payment rejected. Customer has been notified.','success');
      panel.classList.remove('open');
    } catch (err) { showToast(err.message||'Reject failed','error'); }
  };
}

// ----- Users -----
function loadUsers() {
  const wrap = document.getElementById('usersTableWrap');
  supabase.from('profiles').select('*').then(({ data, error }) => {
    if (error) {
      console.error('users load error', error);
      return;
    }
    renderUsersTable(data || []);
  });
}

function renderUsersTable(rows) {
  const wrap = document.getElementById('usersTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No users</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  t.innerHTML = `<thead><tr><th>Email</th><th>Name</th><th>Phone</th><th>Role</th><th>CreatedAt</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r.email}</td><td>${r.first_name||''} ${r.last_name||''}</td><td>${r.phone||''}</td><td>${r.role||''}</td><td>${r.created_at?.substring(0,10)||''}</td>`;
    body.appendChild(tr);
  });
  t.appendChild(body);
  wrap.innerHTML=''; wrap.appendChild(t);
}

// ----- Pending Payments -----
function setupPendingPayments() {
  const wrap = document.getElementById('pendingPaymentsTableWrap');
  
  // Load pending payments
  supabase.from('bookings').select('*').eq('status', 'payment_submitted').then(({ data, error }) => {
    if (error) {
      console.error('pending payments load error', error);
      return;
    }
    renderPendingPaymentsTable(data || []);
    
    // Add badge if pending
    if ((data || []).length > 0) {
      const badge = document.getElementById('pending-badge');
      if (badge) {
        badge.style.boxShadow = '0 0 10px var(--gold)';
        setTimeout(() => { badge.style.boxShadow = ''; }, 2200);
        try { const a = new Audio(); a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; a.play().catch(()=>{}); } catch(e){}
      }
    }
  });
}

function renderPendingPaymentsTable(rows) {
  const wrap = document.getElementById('pendingPaymentsTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No pending payments</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  t.innerHTML = `<thead><tr><th>#</th><th>Booking Ref</th><th>Passenger</th><th>Email</th><th>Phone</th><th>Route</th><th>Amount</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach((r,i) => {
    const tr = document.createElement('tr');
    const flight = r.flight_json || {};
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.booking_ref||''}</td>
      <td>${(r.passenger_first||'') + ' ' + (r.passenger_last||'')}</td>
      <td>${r.passenger_email||''}</td>
      <td>${r.passenger_phone||''}</td>
      <td>${flight.fromCity||''} → ${flight.toCity||''}</td>
      <td>$${flight.price||0}</td>
      <td>${r.created_at?.substring(0,10)||''}</td>
      <td>${r.status||''}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end">
          <button class="approve-small" data-id="${r.id}" style="background:var(--success);color:#fff;padding:6px 10px;border-radius:6px;border:none;font-weight:700;font-size:13px">✓</button>
          <button class="reject-small" data-id="${r.id}" style="background:var(--danger);color:#fff;padding:6px 10px;border-radius:6px;border:none;font-weight:700;font-size:13px">✕</button>
        </div>
      </td>
    `;
    body.appendChild(tr);
  });
  t.appendChild(body); wrap.innerHTML=''; wrap.appendChild(t);

  // Wire inline buttons
  wrap.querySelectorAll('.approve-small').forEach(b => b.addEventListener('click', async (e) => {
    const bookingId = b.dataset.id;
    if (!confirm('Approve this payment and issue ticket?')) return;
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/approvePayment', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ bookingId }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Approve failed');
      showToast('Payment approved and ticket issued','success');
      setupPendingPayments();
    } catch (err) { console.error(err); showToast(err.message||'Approve failed','error'); }
  }));

  wrap.querySelectorAll('.reject-small').forEach(b => b.addEventListener('click', async (e) => {
    const bookingId = b.dataset.id;
    const reason = prompt('Enter rejection reason (required)');
    if (!reason) return showToast('Rejection reason required','error');
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch('/api/admin/rejectPayment', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ bookingId, reason }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Reject failed');
      showToast('Payment rejected and customer notified','success');
      setupPendingPayments();
    } catch (err) { console.error(err); showToast(err.message||'Reject failed','error'); }
  }));
}

// ----- Helpers -----
function renderGenericTable(wrap, rows, cols, table) {
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No data</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  const header = cols.map(c => `<th>${c}</th>`).join('');
  t.innerHTML = `<thead><tr>${header}<th>Actions</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    const cells = cols.map(c => `<td>${r[c]||''}</td>`).join('');
    tr.innerHTML = cells + `<td><button class="del-btn" data-id="${r.id}" data-table="${table}">Delete</button></td>`;
    body.appendChild(tr);
  });
  t.appendChild(body);
  wrap.innerHTML=''; wrap.appendChild(t);

  wrap.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', async e => {
    if (!confirm('Delete?')) return;
    try {
      await supabase.from(b.dataset.table).delete().eq('id', b.dataset.id);
      showToast('Deleted','success');
    } catch(e){ showToast('Delete failed','error'); }
  }));
}

// ----- Helpers -----
function showToast(msg, type=''){
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = type ? `show ${type}` : 'show';
  setTimeout(() => { toast.className = toast.className.replace('show','').trim(); }, 4000);
}
