// =============================================
// GRANDSKY AIRWAYS — Homepage Logic
// =============================================
// Firebase usage commented out in backup file — auth migrated to Supabase.
// TODO: migrate this backup script to Supabase or serverless endpoints.
// import { auth, db } from './firebase-config.js';
// import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// import { collection, getDocs, query, where, limit }
//   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Auth state ──
// Auth state
onAuthStateChanged(auth, user => {
  setupAccountUI(!!user);
});

function setupAccountUI(loggedIn) {
  const navLinks = document.querySelector('.nav-links');
  const navBtn = document.getElementById('nav-auth-btn');
  const mobileBtn = document.getElementById('mobile-auth-btn');

  if (loggedIn) {
    // Replace desktop auth link with dropdown
    const existingDropdown = document.getElementById('accountDropdown');
    if (!existingDropdown) {
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
        e.preventDefault();
        try { await signOut(auth); } catch(_){ }
        window.location.href = 'index.html';
      });
    }

    // Mobile: show My Account and add a Sign out item
    if (mobileBtn) {
      mobileBtn.textContent = 'My Account';
      mobileBtn.href = 'pages/account.html';
      if (!document.getElementById('mobile-signout')) {
        const mobileSign = document.createElement('a');
        mobileSign.id = 'mobile-signout';
        mobileSign.href = '#';
        mobileSign.textContent = 'Sign out';
        mobileSign.addEventListener('click', async (e) => { e.preventDefault(); try { await signOut(auth); } catch(_){}; window.location.href = 'index.html'; });
        mobileBtn.after(mobileSign);
      }
    }
  } else {
    // Not logged in: ensure sign in links exist
    if (!navBtn || navBtn.getAttribute('href') === 'javascript:void(0)') {
      const loginLink = document.createElement('a');
      loginLink.className = 'nav-link';
      loginLink.id = 'nav-auth-btn';
      loginLink.href = 'pages/login.html';
      loginLink.textContent = 'Sign In';
      const dropdown = document.getElementById('accountDropdown');
      if (dropdown) dropdown.replaceWith(loginLink);
      else navLinks.appendChild(loginLink);
    } else {
      navBtn.href = 'pages/login.html';
      navBtn.textContent = 'Sign In';
    }

    if (mobileBtn) {
      mobileBtn.textContent = 'Sign In';
      mobileBtn.href = 'pages/login.html';
    }
    const mobileSign = document.getElementById('mobile-signout'); if (mobileSign) mobileSign.remove();
  }
}

// Close dropdown when clicking outside
window.addEventListener('click', function(e) {
  const dropdown = document.getElementById('accountDropdown');
  if (!dropdown) return;
  if (!dropdown.contains(e.target)) dropdown.classList.remove('show');
});

// ── Sticky nav ──
const nav = document.getElementById('mainNav');
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY > 60;
  nav.classList.toggle('filled', scrolled);
  nav.classList.toggle('transparent', !scrolled);
}, { passive: true });

// ── Hero background zoom ──
document.getElementById('heroBg').classList.add('loaded');

// ── Hamburger ──
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger?.addEventListener('click', () => {
  hamburger.classList.toggle('open');
  mobileMenu.classList.toggle('open');
});

// ══════════════════════════════════════
// AIRPORTS DATA
// ══════════════════════════════════════
const AIRPORTS = [
  { code:'LHR', city:'London',        country:'United Kingdom', region:'Europe',        name:'Heathrow Airport',              flag:'🇬🇧' },
  { code:'LGW', city:'London',        country:'United Kingdom', region:'Europe',        name:'Gatwick Airport',               flag:'🇬🇧' },
  { code:'JFK', city:'New York',      country:'United States',  region:'North America', name:'John F. Kennedy Intl',          flag:'🇺🇸' },
  { code:'LAX', city:'Los Angeles',   country:'United States',  region:'North America', name:'LAX International',             flag:'🇺🇸' },
  { code:'ORD', city:'Chicago',       country:'United States',  region:'North America', name:"O'Hare International",          flag:'🇺🇸' },
  { code:'MIA', city:'Miami',         country:'United States',  region:'North America', name:'Miami International',           flag:'🇺🇸' },
  { code:'CDG', city:'Paris',         country:'France',         region:'Europe',        name:'Charles de Gaulle Airport',     flag:'🇫🇷' },
  { code:'DXB', city:'Dubai',         country:'UAE',            region:'Middle East',   name:'Dubai International',           flag:'🇦🇪' },
  { code:'AUH', city:'Abu Dhabi',     country:'UAE',            region:'Middle East',   name:'Zayed International',           flag:'🇦🇪' },
  { code:'SIN', city:'Singapore',     country:'Singapore',      region:'Asia',          name:'Changi Airport',                flag:'🇸🇬' },
  { code:'HND', city:'Tokyo',         country:'Japan',          region:'Asia',          name:'Haneda Airport',                flag:'🇯🇵' },
  { code:'NRT', city:'Tokyo',         country:'Japan',          region:'Asia',          name:'Narita International',          flag:'🇯🇵' },
  { code:'SYD', city:'Sydney',        country:'Australia',      region:'Oceania',       name:'Kingsford Smith Airport',       flag:'🇦🇺' },
  { code:'MEL', city:'Melbourne',     country:'Australia',      region:'Oceania',       name:'Melbourne Airport',             flag:'🇦🇺' },
  { code:'AMS', city:'Amsterdam',     country:'Netherlands',    region:'Europe',        name:'Schiphol Airport',              flag:'🇳🇱' },
  { code:'FCO', city:'Rome',          country:'Italy',          region:'Europe',        name:'Fiumicino Airport',             flag:'🇮🇹' },
  { code:'MXP', city:'Milan',         country:'Italy',          region:'Europe',        name:'Malpensa Airport',              flag:'🇮🇹' },
  { code:'BKK', city:'Bangkok',       country:'Thailand',       region:'Asia',          name:'Suvarnabhumi Airport',          flag:'🇹🇭' },
  { code:'CPT', city:'Cape Town',     country:'South Africa',   region:'Africa',        name:'Cape Town International',       flag:'🇿🇦' },
  { code:'JNB', city:'Johannesburg',  country:'South Africa',   region:'Africa',        name:'O.R. Tambo International',      flag:'🇿🇦' },
  { code:'GRU', city:'São Paulo',     country:'Brazil',         region:'South America', name:'Guarulhos International',       flag:'🇧🇷' },
  { code:'YYZ', city:'Toronto',       country:'Canada',         region:'North America', name:'Pearson International',         flag:'🇨🇦' },
  { code:'YVR', city:'Vancouver',     country:'Canada',         region:'North America', name:'Vancouver International',       flag:'🇨🇦' },
  { code:'NBO', city:'Nairobi',       country:'Kenya',          region:'Africa',        name:'Jomo Kenyatta Intl',            flag:'🇰🇪' },
  { code:'BOM', city:'Mumbai',        country:'India',          region:'Asia',          name:'Chhatrapati Shivaji Maharaj',   flag:'🇮🇳' },
  { code:'DEL', city:'Delhi',         country:'India',          region:'Asia',          name:'Indira Gandhi International',   flag:'🇮🇳' },
  { code:'PEK', city:'Beijing',       country:'China',          region:'Asia',          name:'Capital International',         flag:'🇨🇳' },
  { code:'PVG', city:'Shanghai',      country:'China',          region:'Asia',          name:'Pudong International',          flag:'🇨🇳' },
  { code:'MEX', city:'Mexico City',   country:'Mexico',         region:'North America', name:'Benito Juárez Intl',            flag:'🇲🇽' },
  { code:'IST', city:'Istanbul',      country:'Turkey',         region:'Europe/Asia',   name:'Istanbul Airport',              flag:'🇹🇷' },
  { code:'BCN', city:'Barcelona',     country:'Spain',          region:'Europe',        name:'El Prat Airport',               flag:'🇪🇸' },
  { code:'MAD', city:'Madrid',        country:'Spain',          region:'Europe',        name:'Adolfo Suárez Barajas',         flag:'🇪🇸' },
  { code:'MUC', city:'Munich',        country:'Germany',        region:'Europe',        name:'Munich Airport',                flag:'🇩🇪' },
  { code:'FRA', city:'Frankfurt',     country:'Germany',        region:'Europe',        name:'Frankfurt Airport',             flag:'🇩🇪' },
  { code:'ZRH', city:'Zürich',        country:'Switzerland',    region:'Europe',        name:'Zürich Airport',                flag:'🇨🇭' },
  { code:'DOH', city:'Doha',          country:'Qatar',          region:'Middle East',   name:'Hamad International',           flag:'🇶🇦' },
  { code:'KUL', city:'Kuala Lumpur',  country:'Malaysia',       region:'Asia',          name:'KLIA Airport',                  flag:'🇲🇾' },
  { code:'ICN', city:'Seoul',         country:'South Korea',    region:'Asia',          name:'Incheon International',         flag:'🇰🇷' },
  { code:'DUB', city:'Dublin',        country:'Ireland',        region:'Europe',        name:'Dublin Airport',                flag:'🇮🇪' },
  { code:'LOS', city:'Lagos',         country:'Nigeria',        region:'Africa',        name:'Murtala Muhammed Intl',         flag:'🇳🇬' },
  { code:'ACC', city:'Accra',         country:'Ghana',          region:'Africa',        name:'Kotoka International',          flag:'🇬🇭' },
  { code:'CMN', city:'Casablanca',    country:'Morocco',        region:'Africa',        name:'Mohammed V International',      flag:'🇲🇦' },
  { code:'CAI', city:'Cairo',         country:'Egypt',          region:'Africa',        name:'Cairo International',           flag:'🇪🇬' },
  { code:'ADD', city:'Addis Ababa',   country:'Ethiopia',       region:'Africa',        name:'Bole International',            flag:'🇪🇹' },
];

let airports = [...AIRPORTS];

// Subscribe to Firestore airports collection if available (real-time)
try {
  const airportsCol = collection(db, 'airports');
  onSnapshot(airportsCol, snap => {
    if (!snap.empty) {
      airports = snap.docs.map(d => d.data());
    } else {
      airports = [...AIRPORTS];
    }
  });
} catch(e) { /* fallback to embedded list */ }

// ══════════════════════════════════════
// AUTOCOMPLETE — full keyboard navigation
// ══════════════════════════════════════
function initAutocomplete(inputId, listId) {
  const input  = document.getElementById(inputId);
  const list   = document.getElementById(listId);
  let activeIndex = -1;
  let lastMatches = [];

  function closeList() {
    list.classList.remove('open');
    list.innerHTML = '';
    activeIndex = -1;
  }

  function renderList(q) {
    list.innerHTML = '';
    activeIndex = -1;

    if (!q.trim()) { closeList(); return; }

    const qLow = q.toLowerCase().trim();
    const matches = airports.filter(a =>
      a.city.toLowerCase().includes(qLow)      ||
      a.code.toLowerCase().startsWith(qLow)    ||
      a.country.toLowerCase().includes(qLow)   ||
      a.name.toLowerCase().includes(qLow)      ||
      (a.region && a.region.toLowerCase().includes(qLow))
    ).slice(0, 8);

    lastMatches = matches;

    if (!matches.length) {
      list.innerHTML = `<div class="ac-empty">No airports found for "<strong>${q}</strong>"</div>`;
      list.classList.add('open');
      return;
    }

    matches.forEach((a, i) => {
      const item = document.createElement('div');
      item.className = 'ac-item';
      item.dataset.index = i;
      item.innerHTML = `
        <div class="ac-badge">${a.code}</div>
        <div style="flex:1;min-width:0">
          <div class="ac-city">${a.flag ? a.flag + ' ' : ''}${a.city}</div>
          <div class="ac-airport">${a.name}</div>
        </div>
        <div class="ac-country">${a.country}</div>`;

      item.addEventListener('mousedown', e => {
        e.preventDefault();
        selectAirport(a);
      });
      list.appendChild(item);
    });

    list.classList.add('open');
  }

  function selectAirport(a) {
    input.value = `${a.city} (${a.code})`;
    input.dataset.code = a.code;
    input.dataset.city = a.city;
    input.dataset.country = a.country;
    closeList();
    input.blur();
  }

  function setActive(idx) {
    const items = list.querySelectorAll('.ac-item');
    items.forEach(el => el.classList.remove('focused'));
    if (idx >= 0 && idx < items.length) {
      items[idx].classList.add('focused');
      items[idx].scrollIntoView({ block: 'nearest' });
    }
    activeIndex = idx;
  }

  input.addEventListener('input', () => renderList(input.value));
  input.addEventListener('focus', () => { if (input.value) renderList(input.value); });
  input.addEventListener('blur',  () => setTimeout(closeList, 180));

  input.addEventListener('keydown', e => {
    if (!list.classList.contains('open')) return;
    const items = list.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && lastMatches[activeIndex]) {
        selectAirport(lastMatches[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      closeList();
    }
  });
}

initAutocomplete('fromInput', 'fromList');
initAutocomplete('toInput',   'toList');

// ── Swap airports ──
document.getElementById('swapBtn')?.addEventListener('click', function() {
  const from = document.getElementById('fromInput');
  const to   = document.getElementById('toInput');
  [from.value,          to.value         ] = [to.value,          from.value         ];
  [from.dataset.code,   to.dataset.code  ] = [to.dataset.code,   from.dataset.code  ];
  [from.dataset.city,   to.dataset.city  ] = [to.dataset.city,   from.dataset.city  ];
  [from.dataset.country,to.dataset.country]=[to.dataset.country, from.dataset.country];
  this.classList.add('spinning');
  setTimeout(() => this.classList.remove('spinning'), 360);
});

// ── Trip tabs ──
document.querySelectorAll('.trip-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.trip-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('returnGroup').style.display =
      this.dataset.type === 'oneway' ? 'none' : '';
  });
});

// ── Passengers ──
let pax = 1;
const paxCount = document.getElementById('paxCount');
const paxLabel = document.getElementById('paxLabel');
document.getElementById('paxPlus')?.addEventListener('click', () => {
  if (pax < 9) { pax++; paxCount.textContent = pax; paxLabel.textContent = pax === 1 ? 'Passenger' : 'Passengers'; }
});
document.getElementById('paxMinus')?.addEventListener('click', () => {
  if (pax > 1) { pax--; paxCount.textContent = pax; paxLabel.textContent = pax === 1 ? 'Passenger' : 'Passengers'; }
});

// ── Set default dates ──
const today = new Date().toISOString().split('T')[0];
document.getElementById('departDate').min   = today;
document.getElementById('departDate').value = today;
document.getElementById('returnDate').min   = today;

// ── Search ──
document.getElementById('searchBtn')?.addEventListener('click', () => {
  const from = document.getElementById('fromInput');
  const to   = document.getElementById('toInput');
  const dep  = document.getElementById('departDate').value;
  const cls  = document.getElementById('cabinClass').value;
  const type = document.querySelector('.trip-tab.active')?.dataset.type || 'roundtrip';
  const ret  = document.getElementById('returnDate').value;

  if (!from.value.trim()) { showToast('Please enter a departure city or airport.', 'error'); return; }
  if (!to.value.trim())   { showToast('Please enter your destination.', 'error'); return; }
  if (!dep)               { showToast('Please select a departure date.', 'error'); return; }
  if (from.dataset.code && from.dataset.code === to.dataset.code) {
    showToast('Origin and destination cannot be the same.', 'error'); return;
  }

  const btn = document.getElementById('searchBtn');
  btn.classList.add('loading');
  document.getElementById('searchBtnText').textContent = 'Searching…';

  const params = new URLSearchParams({
    from:     from.dataset.code || from.value,
    fromCity: from.dataset.city || from.value,
    to:       to.dataset.code   || to.value,
    toCity:   to.dataset.city   || to.value,
    depart: dep, return: ret, pax, class: cls, type
  });

  setTimeout(() => window.location.href = `pages/flights.html?${params}`, 650);
});

// ══════════════════════════════════════
// COUNTRY DESTINATIONS
// ══════════════════════════════════════
const COUNTRY_DESTINATIONS = [
  {
    country: 'France',      flag: '🇫🇷', region: 'Western Europe',
    price: 320,
    img: 'css/assets/france.jpg',
    toCode: 'CDG', toCity: 'Paris'
  },
  {
    country: 'UAE',         flag: '🇦🇪', region: 'Middle East',
    price: 480,
    img: 'css/assets/uae.jpg',
    toCode: 'DXB', toCity: 'Dubai'
  },
  {
    country: 'Japan',       flag: '🇯🇵', region: 'East Asia',
    price: 790,
    img: 'css/assets/japan.jpg',
    toCode: 'HND', toCity: 'Tokyo'
  },
  {
    country: 'Spain',       flag: '🇪🇸', region: 'Southern Europe',
    price: 210,
    img: 'css/assets/spain.jpg',
    toCode: 'BCN', toCity: 'Barcelona'
  },
  {
    country: 'South Africa',flag: '🇿🇦', region: 'Southern Africa',
    price: 540,
    img: 'css/assets/south-africa.jpg',
    toCode: 'CPT', toCity: 'Cape Town'
  },
  {
    country: 'Australia',   flag: '🇦🇺', region: 'Oceania',
    price: 870,
    img: 'css/assets/australia.jpg',
    toCode: 'SYD', toCity: 'Sydney'
  },
];

async function loadDestinations() {
  const grid = document.getElementById('destGrid');
  let items = COUNTRY_DESTINATIONS;

  try {
    // Use real-time featured flights if available
    const q = query(collection(db, 'flights'), where('featured', '==', true), limit(6));
    // subscribe
    onSnapshot(q, snap => {
      if (!snap.empty) {
        const used = snap.docs.map(d => {
          const data = d.data();
          const match = COUNTRY_DESTINATIONS.find(c => c.toCode === data.toCode);
          return { ...match, ...data };
        }).filter(Boolean);
        if (used.length >= 1) items = used;
      }
      renderDestGrid(items, grid);
    });
    return;
  } catch(e) { /* use defaults */ }

  grid.innerHTML = items.map((dest) => `
    <div class="dest-card" onclick="goTo('${dest.toCode}','${dest.toCity}','${dest.country}')">
      <div class="dest-img" style="background-image:url('${dest.img}')"></div>
      <div class="dest-overlay"></div>
      <div class="dest-info">
        <span class="dest-flag">${dest.flag}</span>
        <div class="dest-country-name">${dest.country}</div>
        <div class="dest-region">${dest.region}</div>
        <div class="dest-price-tag">
          <span class="from">from</span> $${dest.price}
        </div>
      </div>
    </div>`
  ).join('');
}

function renderDestGrid(items, grid) {
  grid.innerHTML = items.map((dest) => `
    <div class="dest-card" onclick="goTo('${dest.toCode}','${dest.toCity}','${dest.country}')">
      <div class="dest-img" style="background-image:url('${dest.img || 'css/assets/default.jpg'}')"></div>
      <div class="dest-overlay"></div>
      <div class="dest-info">
        <span class="dest-flag">${dest.flag || ''}</span>
        <div class="dest-country-name">${dest.country || dest.toCity}</div>
        <div class="dest-region">${dest.region || ''}</div>
        <div class="dest-price-tag">
          <span class="from">from</span> $${dest.price || ''}
        </div>
      </div>
    </div>`
  ).join('');
}

window.goTo = function(code, city, country) {
  const toInput = document.getElementById('toInput');
  toInput.value = `${city} (${code})`;
  toInput.dataset.code = code;
  toInput.dataset.city = city;
  toInput.dataset.country = country || '';
  document.querySelector('.search-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => document.getElementById('fromInput').focus(), 400);
};

loadDestinations();

// ══════════════════════════════════════
// TICKER
// ══════════════════════════════════════
const ROUTES = [
  'London → Paris','Dubai → Singapore','New York → London',
  'Tokyo → Sydney','Barcelona → Nairobi','Frankfurt → Cape Town',
  'Mumbai → Dubai','Toronto → Amsterdam','Lagos → London',
  'Doha → New York','Seoul → Toronto','Zürich → Tokyo',
];
const ticker = document.getElementById('tickerTrack');
const full   = [...ROUTES, ...ROUTES];
ticker.innerHTML = full.map(r =>
  `<span class="ticker-item"><span class="ticker-sep">✦</span> ${r}</span>`
).join('');

// ══════════════════════════════════════
// SCROLL REVEALS
// ══════════════════════════════════════
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ══════════════════════════════════════
// TOAST
// ══════════════════════════════════════
function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = type ? `show ${type}` : 'show';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = t.className.replace('show','').trim(); }, 3800);
}
