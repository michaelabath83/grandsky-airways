// =============================================
// GrandSky Airways — Flights Results Logic
// =============================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Read URL params
const p = new URLSearchParams(location.search);
const searchFrom  = p.get('from')  || '';
const fromCity    = p.get('fromCity') || searchFrom;
const searchTo    = p.get('to')    || '';
const toCity      = p.get('toCity')   || searchTo;
const departDate  = p.get('depart') || '';
const pax         = parseInt(p.get('pax') || 1);
const cabinClass  = p.get('class') || 'economy';
const tripType    = p.get('type')  || 'roundtrip';

// Populate summary bar
document.getElementById('summaryFrom').textContent = `${fromCity} (${searchFrom})`;
document.getElementById('summaryTo').textContent   = `${toCity} (${searchTo})`;
document.getElementById('summaryDate').textContent = departDate ? new Date(departDate).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '';
document.getElementById('summaryPax').textContent  = `${pax} passenger${pax>1?'s':''}`;
document.getElementById('summaryClass').textContent = cabinClass.charAt(0).toUpperCase() + cabinClass.slice(1);

// Nav auth
onAuthStateChanged(auth, user => {
  setupAccountUI(!!user);
});

function setupAccountUI(loggedIn) {
  const navLinks = document.querySelector('.nav-links');
  const navBtn = document.getElementById('nav-auth-btn');
  const mobileBtn = document.getElementById('mobile-auth-btn');

  if (loggedIn) {
    // Desktop dropdown
    if (!document.getElementById('accountDropdown')) {
      const dropdown = document.createElement('div');
      dropdown.className = 'nav-dropdown';
      dropdown.id = 'accountDropdown';
      dropdown.innerHTML = `
        <a href="javascript:void(0)" class="nav-link" id="nav-auth-btn">My Account</a>
        <div class="dropdown-content" id="dropdownMenu">
          <a href="#" class="dropdown-item" id="signOutBtn">Sign out</a>
        </div>
      `;
      if (navBtn) navBtn.replaceWith(dropdown); else navLinks.appendChild(dropdown);

      const anchor = dropdown.querySelector('#nav-auth-btn');
      anchor.addEventListener('click', (e) => { e.preventDefault(); dropdown.classList.toggle('show'); });
      dropdown.querySelector('#signOutBtn').addEventListener('click', async (e) => {
        e.preventDefault(); try { await signOut(auth); } catch(_){}; window.location.href = '../index.html';
      });
    }

    // Mobile: add sign out link
    if (mobileBtn) {
      mobileBtn.textContent = 'My Account';
      mobileBtn.href = 'account.html';
      if (!document.getElementById('mobile-signout')) {
        const mobileSign = document.createElement('a');
        mobileSign.id = 'mobile-signout';
        mobileSign.href = '#';
        mobileSign.textContent = 'Sign out';
        mobileSign.addEventListener('click', async (e) => { e.preventDefault(); try { await signOut(auth); } catch(_){}; window.location.href = '../index.html'; });
        mobileBtn.after(mobileSign);
      }
    }
  } else {
    if (!navBtn || navBtn.getAttribute('href') === 'javascript:void(0)') {
      const loginLink = document.createElement('a');
      loginLink.className = 'nav-btn';
      loginLink.id = 'nav-auth-btn';
      loginLink.href = 'login.html';
      loginLink.textContent = 'Sign In';
      const dropdown = document.getElementById('accountDropdown');
      if (dropdown) dropdown.replaceWith(loginLink); else navLinks.appendChild(loginLink);
    } else {
      navBtn.href = 'login.html'; navBtn.textContent = 'Sign In';
    }
    if (mobileBtn) { mobileBtn.textContent = 'Sign In'; mobileBtn.href = 'login.html'; }
    const mobileSign = document.getElementById('mobile-signout'); if (mobileSign) mobileSign.remove();
  }
}

// Close dropdown when clicking outside (pages)
window.addEventListener('click', function(e) {
  const dropdown = document.getElementById('accountDropdown');
  if (!dropdown) return;
  if (!dropdown.contains(e.target)) dropdown.classList.remove('show');
});

// Hamburger
document.getElementById('hamburger').addEventListener('click', function() {
  this.classList.toggle('open');
  document.getElementById('mobileMenu').classList.toggle('open');
});

// Airlines list
const AIRLINES = [
  { code:'SW', name:'GrandSky Airways Express', color:'#C6922A' },
  { code:'UA', name:'UniAir',         color:'#E8B84B' },
  { code:'GX', name:'GlobeX',         color:'#059669' },
  { code:'ZA', name:'ZenAir',         color:'#dc2626' },
  { code:'PA', name:'PacificAir',     color:'#d97706' },
  { code:'NA', name:'NorthAir',       color:'#0891b2' },
];
const AMENITIES = ['✓ Carry-on', '✓ Wi-Fi', '✓ Meal', '✓ USB'];

// Generate fallback flights
function generateFlights(from, to, count = 12) {
  const flights = [];
  const basePrice = Math.floor(Math.random() * 300 + 120);
  const departureTimes = ['06:15','07:30','09:45','11:00','12:20','13:55','15:10','17:30','18:45','20:00','21:30','23:10'];
  const durations = [90,120,150,180,210,240,270,300,330,360,420,480];

  for (let i = 0; i < count; i++) {
    const airline = AIRLINES[i % AIRLINES.length];
    const durationMin = durations[i % durations.length];
    const stops = i % 5 === 0 ? 0 : i % 3 === 0 ? 2 : 1;
    const priceMultiplier = { economy:1, premium:1.4, business:2.2, first:3.5 }[cabinClass] || 1;
    const stopMultiplier  = stops === 0 ? 1.25 : stops === 1 ? 1 : 0.8;
    const price = Math.round(basePrice * priceMultiplier * stopMultiplier + i * 18);
    const depTime = departureTimes[i % departureTimes.length];
    const [dh, dm] = depTime.split(':').map(Number);
    const arrMins  = dh * 60 + dm + durationMin;
    const arrTime  = `${String(Math.floor(arrMins/60)%24).padStart(2,'0')}:${String(arrMins%60).padStart(2,'0')}`;
    const h = Math.floor(durationMin/60), m = durationMin%60;

    flights.push({
      id: `${from}-${to}-${i}`,
      airline, from, to,
      depTime, arrTime,
      duration: `${h}h ${m}m`,
      durationMin, stops,
      price, pricePer: price,
      priceTotal: price * pax,
      amenities: AMENITIES.slice(0, 2 + (i%3)),
      flightNum: `${airline.code}${100 + i * 7}`,
      depPeriod: dh < 12 ? 'morning' : dh < 18 ? 'afternoon' : 'evening',
    });
  }
  return flights;
}

let allFlights = [];
let filtered   = [];

// Load flights from Firestore or fallback
async function loadFlights() {
  try {
    const snap = await getDocs(query(
      collection(db, 'flights'),
      where('fromCode', '==', searchFrom),
      where('toCode',   '==', searchTo)
    ));
    if (!snap.empty) {
      allFlights = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        pricePer: d.data().price,
        priceTotal: d.data().price * pax,
      }));
    } else {
      allFlights = generateFlights(searchFrom, searchTo);
    }
  } catch(e) {
    allFlights = generateFlights(searchFrom, searchTo);
  }

  // Mark best value
  const cheapest = Math.min(...allFlights.map(f => f.price));
  allFlights.forEach(f => { f.bestValue = f.price === cheapest; });

  filtered = [...allFlights];
  renderFlights();
  document.getElementById('resultsTitle').textContent = `${allFlights.length} flights found`;
  document.getElementById('resultsSub').textContent   = `${fromCity} → ${toCity} · ${departDate ? new Date(departDate).toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'}) : ''}`;
}

function renderFlights() {
  const list = document.getElementById('flightsList');
  if (!filtered.length) {
    list.innerHTML = `
      <div class="no-results">
        <div class="no-results-icon">✈️</div>
        <h3>No flights match your filters</h3>
        <p>Try adjusting your filters or clearing them.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(f => `
    <div class="flight-card${f.bestValue?' best-value':''}" data-id="${f.id}" data-price="${f.price}">
      <div class="flight-main">
        <div class="airline-row">
          <div class="airline-logo" style="border-color:${f.airline?.color||'#ccc'}20;color:${f.airline?.color||'var(--gold)'}">
            <img class="airline-logo-img" src="/css/assets/logos/${f.airline?.code||'UNKNOWN'}.svg" alt="${f.airline?.code||''} logo" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block'" />
            <span class="airline-code-fallback" style="display:inline-block">${(f.airline?.code||'?')}</span>
          </div>
          <div>
            <div class="airline-name">${f.airline?.name||'GrandSky Airways'}</div>
            <div class="flight-number">${f.flightNum||''}</div>
          </div>
          ${f.bestValue ? '<div class="best-badge">⭐ Best Value</div>' : ''}
        </div>

        <div class="itinerary-row">
          <div class="itin-time">
            <strong>${f.depTime}</strong>
            <span>${f.from}</span>
          </div>
          <div class="itin-line">
            <div class="itin-duration">${f.duration}</div>
            <div class="itin-bar">
              ${f.stops > 0 ? '<div class="stop-dot"></div>' : ''}
              ${f.stops > 1 ? '<div class="stop-dot" style="position:absolute;right:30%"></div>' : ''}
            </div>
            <div class="itin-stops ${f.stops===0?'nonstop':''}">
              ${f.stops===0?'Nonstop':f.stops===1?'1 stop':'2 stops'}
            </div>
          </div>
          <div class="itin-time">
            <strong>${f.arrTime}</strong>
            <span>${f.to}</span>
          </div>
        </div>

        <div class="itin-amenities">
          ${(f.amenities||[]).map(a=>`<span class="amenity">${a}</span>`).join('')}
        </div>
      </div>

      <div class="flight-cta">
        <div class="price-block">
          <div class="price-amount">$${f.pricePer}</div>
          <div class="price-per">per person</div>
          ${pax > 1 ? `<div class="price-total">$${f.priceTotal} total</div>` : ''}
        </div>
        <button class="select-btn" onclick="selectFlight('${f.id}', ${f.pricePer}, '${f.airline?.name||'GrandSky Airways'}', '${f.depTime}', '${f.arrTime}', '${f.duration}', ${f.stops})">
          Select →
        </button>
      </div>
    </div>
  `).join('');
}

// Select a flight
window.selectFlight = function(id, price, airline, dep, arr, dur, stops) {
  sessionStorage.setItem('selectedFlight', JSON.stringify({
    id, price, airline, dep, arr, dur, stops,
    from: searchFrom, fromCity, to: searchTo, toCity,
    departDate, pax, cabinClass, tripType
  }));

  // Check auth
  const user = auth.currentUser;
  if (!user) {
    sessionStorage.setItem('postLoginRedirect', 'payment.html');
    window.location.href = 'login.html?redirect=payment.html';
  } else {
    window.location.href = 'payment.html';
  }
};

// ── Filters ──
const maxPrice = document.getElementById('priceRange');
const priceLabel = document.getElementById('priceRangeVal');
maxPrice.addEventListener('input', () => {
  priceLabel.textContent = '$' + maxPrice.value;
  applyFilters();
});

document.querySelectorAll('.filter-check input').forEach(cb => {
  cb.addEventListener('change', applyFilters);
});

document.getElementById('sortSelect').addEventListener('change', applyFilters);

document.getElementById('clearFilters').addEventListener('click', () => {
  maxPrice.value = 3000;
  priceLabel.textContent = '$3000';
  document.querySelectorAll('.filter-check input').forEach(cb => { cb.checked = true; });
  document.getElementById('sortSelect').value = 'price';
  applyFilters();
});

function applyFilters() {
  const maxP = parseInt(maxPrice.value);
  const stops = [...document.querySelectorAll('.filter-group:nth-child(2) .filter-check input')]
    .filter(c=>c.checked).map(c=>parseInt(c.value));
  const periods = [...document.querySelectorAll('.filter-group:nth-child(3) .filter-check input')]
    .filter(c=>c.checked).map(c=>c.value);
  const sort = document.getElementById('sortSelect').value;

  filtered = allFlights
    .filter(f => f.price <= maxP)
    .filter(f => stops.includes(Math.min(f.stops, 2)))
    .filter(f => periods.includes(f.depPeriod));

  if (sort === 'price')    filtered.sort((a,b) => a.price - b.price);
  if (sort === 'duration') filtered.sort((a,b) => a.durationMin - b.durationMin);
  if (sort === 'depart')   filtered.sort((a,b) => a.depTime.localeCompare(b.depTime));

  renderFlights();
}

// Init
window.addEventListener('scroll', () => {
  document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 10);
}, {passive:true});
loadFlights();
