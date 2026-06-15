// Admin panel logic
import { auth, db, ADMIN_EMAILS } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, query, where, onSnapshot, addDoc, setDoc, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { approvePayment, rejectPayment } from './approvePayment.js';

const BOOKING_STATUS = {
  PENDING_PAYMENT:    'pending_payment',
  PAYMENT_SUBMITTED:  'payment_submitted',
  PAYMENT_APPROVED:   'payment_approved',
  TICKET_SENT:        'ticket_sent',
  PAYMENT_REJECTED:   'payment_rejected',
  CANCELLED:          'cancelled'
};

// Guard admin access
onAuthStateChanged(auth, user => {
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    // when running from pages/admin.html, the login page is in the same folder
    window.location.href = 'login.html';
    return;
  }
  document.getElementById('adminEmail').textContent = user.email;
  initAdmin();
});

document.getElementById('adminSignOut').addEventListener('click', async () => {
  await signOut(auth); window.location.href = '../index.html';
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
    const bSnap = await getDocs(collection(db, 'bookings'));
    document.getElementById('statBookings').querySelector('.val').textContent = bSnap.size;
    const uSnap = await getDocs(collection(db, 'users'));
    document.getElementById('statUsers').querySelector('.val').textContent = uSnap.size;
    const fSnap = await getDocs(collection(db, 'flights'));
    document.getElementById('statRoutes').querySelector('.val').textContent = fSnap.size;

    // revenue
    let revenue = 0;
    bSnap.forEach(d => { const data = d.data(); if (data.payment && data.payment.amount) revenue += Number(data.payment.amount || 0); });
    document.getElementById('statRevenue').querySelector('.val').textContent = '$' + revenue.toFixed(2);
  } catch(e) { showToast('Could not load stats', 'error'); }
}

// ----- Flights Manager -----
function setupFlightsManager() {
  const wrap = document.getElementById('flightsTableWrap');
  const col = collection(db, 'flights');

  onSnapshot(col, snap => {
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    renderFlightsTable(rows);
  }, err => { showToast('Could not load flights', 'error'); });

  document.getElementById('addRouteBtn').addEventListener('click', () => openFlightModal());
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
      <td>${r.fromCity} (${r.fromCode})</td>
      <td>${r.toCity} (${r.toCode})</td>
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
    try { await deleteDoc(doc(db, 'flights', b.dataset.id)); showToast('Route deleted', 'success'); } catch(e){ showToast('Delete failed','error'); }
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
    // load doc
    getDocs(query(collection(db,'flights'))).then(snap => {
      const docData = snap.docs.find(d => d.id === id);
      if (docData) fillModalFields({ id: docData.id, ...docData.data() });
    });
    modal.querySelector('#saveRoute').onclick = async () => { await saveRoute(id); modal.classList.remove('open'); };
  }
}

function fillModalFields(d) {
  document.getElementById('f_from').value = d.fromCity ? `${d.fromCity} (${d.fromCode||''})` : '';
  document.getElementById('f_to').value = d.toCity ? `${d.toCity} (${d.toCode||''})` : '';
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
    fromCity: parseCity(document.getElementById('f_from').value).city,
    fromCode: parseCity(document.getElementById('f_from').value).code,
    toCity: parseCity(document.getElementById('f_to').value).city,
    toCode: parseCity(document.getElementById('f_to').value).code,
    price: Number(document.getElementById('f_price').value)||0,
    airline: document.getElementById('f_airline').value,
    dep: document.getElementById('f_dep').value,
    arr: document.getElementById('f_arr').value,
    duration: document.getElementById('f_dur').value,
    stops: Number(document.getElementById('f_stops').value),
    featured: document.getElementById('f_featured').checked,
    updatedAt: serverTimestamp()
  };
  try {
    if (id) {
      await setDoc(doc(db,'flights',id), payload, { merge:true });
      showToast('Route updated','success');
    } else {
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db,'flights'), payload);
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
  const col = collection(db, 'airports');
  onSnapshot(col, snap => {
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderGenericTable(wrap, rows, ['code','city','country','name','region'], 'airports');
  });
}

// ----- Airlines -----
function loadAirlines() {
  const wrap = document.getElementById('airlinesTableWrap');
  const col = collection(db, 'airlines');
  onSnapshot(col, snap => {
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderGenericTable(wrap, rows, ['code','name','color'], 'airlines');
  });
}

// ----- Import / Refresh helpers -----
function attachImportHandlers() {
  // Flights
  document.getElementById('importFlightsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToCollection('flights', f);
    e.target.value = '';
  });
  document.getElementById('refreshFlights')?.addEventListener('click', async () => {
    const snap = await getDocs(collection(db,'flights'));
    renderFlightsTable(snap.docs.map(d=>({ id:d.id, ...d.data() })));
  });

  // Airports
  document.getElementById('importAirportsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToCollection('airports', f); e.target.value = '';
  });
  document.getElementById('refreshAirports')?.addEventListener('click', async () => {
    const snap = await getDocs(collection(db,'airports'));
    renderGenericTable(document.getElementById('airportsTableWrap'), snap.docs.map(d=>({ id:d.id, ...d.data() })), ['code','city','country','name','region'], 'airports');
  });

  // Airlines
  document.getElementById('importAirlinesInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToCollection('airlines', f); e.target.value = '';
  });
  document.getElementById('refreshAirlines')?.addEventListener('click', async () => {
    const snap = await getDocs(collection(db,'airlines'));
    renderGenericTable(document.getElementById('airlinesTableWrap'), snap.docs.map(d=>({ id:d.id, ...d.data() })), ['code','name','color'], 'airlines');
  });

  // Bookings
  document.getElementById('importBookingsInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToCollection('bookings', f); e.target.value = '';
  });
  document.getElementById('refreshBookings')?.addEventListener('click', async () => {
    const snap = await getDocs(collection(db,'bookings'));
    renderBookingsTable(snap.docs.map(d=>({ id:d.id, ...d.data() })));
  });

  // Users
  document.getElementById('importUsersInput')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; await importJsonToCollection('users', f); e.target.value = '';
  });
  document.getElementById('refreshUsers')?.addEventListener('click', async () => {
    const snap = await getDocs(collection(db,'users'));
    renderGenericTable(document.getElementById('usersTableWrap'), snap.docs.map(d=>({ id:d.id, ...d.data() })), ['firstName','lastName','email','role'], 'users');
  });
}

// Seed defaults from bundled data files (served from /data/)
document.getElementById('seedDefaults')?.addEventListener('click', async () => {
  if (!confirm('Seed default airports, airlines and featured flights to Firestore? This will add items but not remove existing entries. Continue?')) return;
  try {
    await fetchAndImport('/data/seed_airports.json', 'airports');
    await fetchAndImport('/data/seed_airlines.json', 'airlines');
    await fetchAndImport('/data/seed_flights.json', 'flights');
    showToast('Seeded default data. Use Refresh on sections to view.', 'success');
  } catch(e) { showToast('Seeding failed — check console.', 'error'); console.error(e); }
});

async function fetchAndImport(url, collectionName) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch ' + url);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid seed format');
  let added = 0;
  for (const item of data) {
    try { await addDoc(collection(db, collectionName), item); added++; } catch(e){ console.error('add fail', e); }
  }
  return added;
}

async function importJsonToCollection(collectionName, file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) return showToast('JSON must be an array of objects', 'error');
    let added = 0;
    for (const item of data) {
      try { await addDoc(collection(db, collectionName), item); added++; } catch(e) { console.error('import item failed', e); }
    }
    showToast(`Imported ${added} items into ${collectionName}`, 'success');
  } catch(e) { showToast('Import failed: invalid JSON or network error', 'error'); }
}

// ----- Bookings viewer -----
function loadBookings() {
  const wrap = document.getElementById('bookingsTableWrap');
  const col = collection(db, 'bookings');
  onSnapshot(col, snap => {
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderBookingsTable(rows);
  });
  document.getElementById('bookingSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    wrap.querySelectorAll('tbody tr').forEach(tr => tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none');
  });
}

// Pending payments real-time listener
function setupPendingPayments() {
  const wrap = document.getElementById('pendingPaymentsTableWrap');
  const q = query(collection(db,'bookings'), where('status','==', BOOKING_STATUS.PAYMENT_SUBMITTED), orderBy('payment.submittedAt','asc'));
  onSnapshot(q, snapshot => {
    const rows = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
    renderPendingPaymentsTable(rows);
    const count = snapshot.size;
    const badge = document.getElementById('pending-badge');
    if (badge) { badge.textContent = count; badge.style.display = count>0 ? 'inline-flex' : 'none'; }
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') highlightNewSubmission(change.doc.data());
    });
  }, err => { showToast('Failed loading pending payments','error'); });
}

function highlightNewSubmission(data) {
  const badge = document.getElementById('pending-badge');
  if (!badge) return;
  badge.style.boxShadow = '0 0 10px var(--gold)';
  setTimeout(() => { badge.style.boxShadow = ''; }, 2200);
  try { const a = new Audio(); a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='; a.play().catch(()=>{}); } catch(e){}
}

function renderPendingPaymentsTable(rows) {
  const wrap = document.getElementById('pendingPaymentsTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No pending payments</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  t.innerHTML = `<thead><tr><th>#</th><th>Booking Ref</th><th>Passenger</th><th>Email</th><th>Phone</th><th>Route</th><th>Amount</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach((r,i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${r.bookingRef||''}</td>
      <td>${(r.passenger?.firstName||'') + ' ' + (r.passenger?.lastName||'')}</td>
      <td>${r.passenger?.email||''}</td>
      <td>${r.passenger?.phone||''}</td>
      <td>${r.flight?.fromCity||''} → ${r.flight?.toCity||''}</td>
      <td>$${r.payment?.amountDue||r.payment?.amount||0}</td>
      <td>${r.payment?.submittedAt? new Date(r.payment.submittedAt.seconds*1000).toLocaleString() : ''}</td>
      <td>${r.status||''}</td>
      <td><button class="btn" data-id="${r.id}" data-ref="${r.bookingRef||''}">Review</button></td>
    `;
    body.appendChild(tr);
  });
  t.appendChild(body); wrap.innerHTML=''; wrap.appendChild(t);
  wrap.querySelectorAll('button[data-id]').forEach(b => b.addEventListener('click', e => openReviewPanel(b.dataset.id)));
}

async function openReviewPanel(bookingId) {
  // load booking
  const bSnap = await getDocs(query(collection(db,'bookings')));
  const docSnap = bSnap.docs.find(d => d.id === bookingId);
  if (!docSnap) return showToast('Booking not found','error');
  const booking = docSnap.data();
  // build slide-in panel
  let panel = document.getElementById('reviewPanel');
  if (!panel) {
    panel = document.createElement('div'); panel.id='reviewPanel'; panel.className='slide-panel';
    panel.innerHTML = `<div class="panel-card"><div id="reviewContent"></div><div style="display:flex;gap:8px;margin-top:12px"><button id="approveBtn" class="nav-cta"><i class="bi bi-check-circle-fill"></i> Approve Payment</button><button id="rejectBtn" class="btn-danger"><i class="bi bi-x-circle-fill"></i> Reject Payment</button><button id="closeReview" class="btn-ghost">Close</button></div></div>`;
    document.body.appendChild(panel);
    panel.querySelector('#closeReview').addEventListener('click', () => panel.classList.remove('open'));
  }
  document.getElementById('reviewContent').innerHTML = `
    <h3>${booking.bookingRef}</h3>
    <div><strong>Passenger:</strong> ${booking.passenger.firstName} ${booking.passenger.lastName}</div>
    <div><strong>Email:</strong> ${booking.passenger.email}</div>
    <div><strong>Phone:</strong> ${booking.passenger.phone}</div>
    <div><strong>Route:</strong> ${booking.flight.fromCity} → ${booking.flight.toCity}</div>
    <div><strong>Amount (USD):</strong> $${booking.payment.amountDue}</div>
    <div><strong>Coin:</strong> ${booking.payment.coin}</div>
  `;
  panel.classList.add('open');

  // wire actions
  document.getElementById('approveBtn').onclick = async () => {
    if (!confirm(`Approve payment for ${booking.bookingRef}? This will generate and email the ticket.`)) return;
    try {
      const adminEmail = document.getElementById('adminEmail').textContent;
      const res = await approvePayment(bookingId, adminEmail);
      showToast(`✓ Payment approved. Ticket sent to ${booking.passenger.email}`,'success');
      panel.classList.remove('open');
    } catch (err) { showToast(err.message||'Approve failed','error'); }
  };

  document.getElementById('rejectBtn').onclick = async () => {
    const reason = prompt('Enter rejection reason (required)');
    if (!reason) return showToast('Rejection reason required','error');
    try {
      const adminEmail = document.getElementById('adminEmail').textContent;
      await rejectPayment(bookingId, adminEmail, reason);
      showToast('Payment rejected. Customer has been notified.','success');
      panel.classList.remove('open');
    } catch (err) { showToast(err.message||'Reject failed','error'); }
  };
}

function renderBookingsTable(rows) {
  const wrap = document.getElementById('bookingsTableWrap');
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No bookings</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  t.innerHTML = `<thead><tr><th>Ref</th><th>Passenger</th><th>Route</th><th>Date</th><th>Class</th><th>Payment</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>`;
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.ref||r.id}</td>
      <td>${r.passengerName||''}</td>
      <td>${r.from||''} → ${r.to||''}</td>
      <td>${r.date||''}</td>
      <td>${r.cabinClass||''}</td>
      <td>${r.payment?.method||''}</td>
      <td>$${r.payment?.amount||0}</td>
      <td>${r.status||''}</td>
      <td><button class="btn-obsidian cancelBtn" data-id="${r.id}">Cancel</button></td>
    `;
    body.appendChild(tr);
  });
  t.appendChild(body); wrap.innerHTML=''; wrap.appendChild(t);
  wrap.querySelectorAll('.cancelBtn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Cancel booking?')) return;
    try { await setDoc(doc(db,'bookings',b.dataset.id), { status:'cancelled', updatedAt: serverTimestamp() }, { merge:true }); showToast('Booking cancelled','success'); } catch(e){ showToast('Failed','error'); }
  }));
}

// ----- Users -----
function loadUsers() {
  const wrap = document.getElementById('usersTableWrap');
  const col = collection(db, 'users');
  onSnapshot(col, snap => {
    const rows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    renderGenericTable(wrap, rows, ['firstName','lastName','email','role'], 'users');
  });
}

// Generic table renderer for CRUD (airports, airlines, users)
function renderGenericTable(wrap, rows, fields, collectionName) {
  if (!rows.length) { wrap.innerHTML = '<div class="panel">No items</div>'; return; }
  const t = document.createElement('table'); t.className='table';
  const thead = document.createElement('thead'); thead.innerHTML = `<tr>${fields.map(f=>`<th>${f}</th>`).join('')}<th>Actions</th></tr>`;
  t.appendChild(thead);
  const body = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `${fields.map(f=>`<td>${r[f]||''}</td>`).join('')}<td><button class="editBtn" data-id="${r.id}"><i class="bi bi-pencil"></i></button><button class="delBtn" data-id="${r.id}"><i class="bi bi-trash"></i></button></td>`;
    body.appendChild(tr);
  });
  t.appendChild(body); wrap.innerHTML=''; wrap.appendChild(t);
  wrap.querySelectorAll('.delBtn').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete item?')) return; try { await deleteDoc(doc(db,collectionName,b.dataset.id)); showToast('Deleted','success'); } catch(e){ showToast('Failed','error'); }
  }));
  wrap.querySelectorAll('.editBtn').forEach(b => b.addEventListener('click', () => {
    showToast('Edit not implemented for this collection (quick mode).','error');
  }));
}

// toast helper
function showToast(msg, type=''){
  const toast = document.getElementById('toast'); toast.textContent = msg; toast.className = type?`show ${type}`:'show'; setTimeout(()=>{ toast.className = toast.className.replace('show','').trim(); },4000);
}
