// =============================================
// GrandSky Airways — Authentication Logic (Supabase)
// =============================================

import { supabase, ADMIN_EMAILS } from './supabase-config.js';

const redirect = new URLSearchParams(location.search).get('redirect') || null;

// Redirect helper
function _adminHref() {
  try {
    const p = location.pathname || '';
    if (p.includes('/pages/')) return 'admin.html';
    return 'pages/admin.html';
  } catch(e) { return 'pages/admin.html'; }
}

// Toast helper
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = type ? `show ${type}` : 'show';
  setTimeout(() => { toast.className = toast.className.replace('show','').trim(); }, 4000);
}

// Auth state listener
supabase.auth.onAuthStateChange((event, session) => {
  const user = session?.user || null;
  if (user) {
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      window.location.href = _adminHref();
      return;
    }
    const dest = sessionStorage.getItem('postLoginRedirect') || redirect || '../index.html';
    sessionStorage.removeItem('postLoginRedirect');
    window.location.href = dest;
  }
});

// Tab switching
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    const target = this.dataset.tab;
    document.getElementById('loginForm').classList.toggle('hidden', target !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', target !== 'register');
  });
});

// Eye toggle
document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// Password strength
document.getElementById('regPass')?.addEventListener('input', function() {
  const val = this.value;
  const fill  = document.getElementById('strengthFill');
  const label = document.getElementById('strengthLabel');
  let score = 0;
  if (val.length >= 8)  score++;
  if (/[A-Z]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;

  const pct   = (score / 4) * 100;
  const colors = ['#e53e3e','#f59e0b','#22c55e','#C6922A'];
  const labels = ['Too weak','Fair','Good','Strong'];

  fill.style.width = pct + '%';
  fill.style.background = colors[score - 1] || '#e2e6f0';
  label.textContent = score > 0 ? labels[score - 1] : '';
  label.style.color = colors[score - 1] || 'var(--muted)';
});

// Forgot password
document.getElementById('forgotLink')?.addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  if (!email) { showToast('Enter your email above first.', 'error'); return; }
  try {
    await supabase.auth.resetPasswordForEmail(email);
    showToast('Password reset email sent! Check your inbox.', 'success');
  } catch(err) {
    showToast('Could not send reset email. Check the address.', 'error');
  }
});
// LOGIN
let isLoggingIn = false;
document.getElementById('loginBtn')?.addEventListener('click', async () => {
  if (isLoggingIn) return; // prevent double-click/spam
  const email = document.getElementById('loginEmail')?.value.trim() || '';
  const pass  = document.getElementById('loginPass')?.value || '';

  if (!email || !pass) { showToast('Please enter your email and password.', 'error'); return; }

  const btn = document.getElementById('loginBtn');
  isLoggingIn = true;
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) {
      // log full error for debugging
      console.error('Sign-in error:', error);
      throw error;
    }
    // onAuthStateChange will redirect
  } catch(err) {
    const msg = err?.message || 'Sign in failed';
    console.error('Sign-in failed:', err);
    if (msg.toLowerCase().includes('invalid')) {
      showToast('Invalid email or password.', 'error');
    } else if (msg.toLowerCase().includes('too many')) {
      showToast('Too many requests. Please wait a minute and try again.', 'error');
    } else {
      showToast(msg, 'error');
    }
  } finally {
    isLoggingIn = false;
    try { btn.disabled = false; btn.classList.remove('loading'); } catch(e){}
  }
});

// REGISTER
let isRegistering = false;
document.getElementById('registerBtn')?.addEventListener('click', async () => {
  const firstName      = document.getElementById('regFirstName')?.value.trim() || '';
  const lastName       = document.getElementById('regLastName')?.value.trim() || '';
  const email          = document.getElementById('regEmail')?.value.trim() || '';
  const dob            = document.getElementById('regDob')?.value || '';
  const nationality    = document.getElementById('regNationality')?.value || '';
  const passport       = document.getElementById('regPassport')?.value.trim() || '';
  const passportExpiry = document.getElementById('regPassportExpiry')?.value || '';
  const phone          = document.getElementById('regPhone')?.value.trim() || '';
  const pass           = document.getElementById('regPass')?.value || '';
  const passConfirm    = document.getElementById('regPassConfirm')?.value || '';
  const terms          = document.getElementById('regTerms')?.checked || false;

  // Validation
  if (!firstName || !lastName)           { showToast('Please enter your full name.', 'error'); return; }
  if (!email)                            { showToast('Please enter your email.', 'error'); return; }
  if (!dob)                              { showToast('Please enter your date of birth.', 'error'); return; }
  if (!nationality)                      { showToast('Please select your nationality.', 'error'); return; }
  if (!phone)                            { showToast('Please enter your phone number.', 'error'); return; }
  if (pass.length < 8)                   { showToast('Password must be at least 8 characters.', 'error'); return; }
  if (pass !== passConfirm)              { showToast('Passwords do not match.', 'error'); return; }
  if (!terms)                            { showToast('Please accept the Terms of Service.', 'error'); return; }

  const btn = document.getElementById('registerBtn');
  if (isRegistering) return;
  isRegistering = true;
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    // Create auth user
    const { data, error } = await supabase.auth.signUp({ email, password: pass });
    if (error) {
      console.error('Sign-up error:', error);
      throw error;
    }

    const user = data?.user;
    if (user) {
      // Update profile with full details
      const { error: profileError } = await supabase.from('profiles').update({
        first_name: firstName,
        last_name: lastName,
        dob,
        nationality,
        passport,
        passport_expiry: passportExpiry,
        phone,
        marketing: document.getElementById('regMarketing')?.checked || false
      }).eq('id', user.id);
      if (profileError) console.warn('Warning: profile update failed:', profileError.message);
    }

    showToast('Account created! Check your email to confirm before signing in.', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
  } catch(err) {
    console.error('Registration failed:', err);
    const msg = err?.message || '';
    if (msg.toLowerCase().includes('too many')) {
      showToast('Too many requests. Please wait and try again.', 'error');
    } else {
      showToast(msg || 'Registration failed.', 'error');
    }
  } finally {
    isRegistering = false;
    try { btn.disabled = false; btn.classList.remove('loading'); } catch(e){}
  }
});

// GOOGLE signin
document.getElementById('googleBtn')?.addEventListener('click', async () => {
  try {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/pages/login.html' } });
  } catch(err) {
    showToast('Google sign-in failed.', 'error');
  }
});

// GOOGLE register
document.getElementById('googleRegisterBtn')?.addEventListener('click', async () => {
  try {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/pages/login.html' } });
  } catch(err) {
    showToast('Google sign-up failed.', 'error');
  }
});
