// =============================================
// GrandSky Airways — Authentication Logic
// =============================================

import { auth, db, ADMIN_EMAILS } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const redirect = new URLSearchParams(location.search).get('redirect') || null;

// Redirect if already logged in
function _adminHref() {
  // If the current page is inside the /pages/ folder, return a same-folder link.
  // Otherwise return the path from project root.
  try {
    const p = location.pathname || '';
    if (p.includes('/pages/')) return 'admin.html';
    return 'pages/admin.html';
  } catch(e) { return 'pages/admin.html'; }
}

onAuthStateChanged(auth, user => {
  if (user) {
    // Prefer admin landing for admin users
    if (user.email && ADMIN_EMAILS.includes(user.email)) {
      window.location.href = _adminHref();
      return;
    }
    const dest = sessionStorage.getItem('postLoginRedirect') || redirect || '../index.html';
    sessionStorage.removeItem('postLoginRedirect');
    window.location.href = dest;
  }
});

// ── Tab switching ──
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    this.classList.add('active');
    const target = this.dataset.tab;
    document.getElementById('loginForm').classList.toggle('hidden', target !== 'login');
    document.getElementById('registerForm').classList.toggle('hidden', target !== 'register');
  });
});

// ── Eye toggle ──
document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

// ── Password strength ──
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

// ── Forgot password ──
document.getElementById('forgotLink').addEventListener('click', async (e) => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  if (!email) { showToast('Enter your email above first.', 'error'); return; }
  try {
    await sendPasswordResetEmail(auth, email);
    showToast('Password reset email sent! Check your inbox.', 'success');
  } catch(err) {
    showToast('Could not send reset email. Check the address.', 'error');
  }
});

// ── LOGIN ──
document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;

  if (!email || !pass) { showToast('Please enter your email and password.', 'error'); return; }

  setLoading('loginBtn', true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    const user = auth.currentUser;
    if (user && ADMIN_EMAILS.includes(user.email)) {
      window.location.href = _adminHref();
    } else {
      const dest = sessionStorage.getItem('postLoginRedirect') || '../index.html';
      sessionStorage.removeItem('postLoginRedirect');
      window.location.href = dest;
    }
  } catch(err) {
    setLoading('loginBtn', false);
    const msgs = {
      'auth/user-not-found':  'No account found with that email.',
      'auth/wrong-password':  'Incorrect password. Try again.',
      'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
      'auth/invalid-email':   'Please enter a valid email address.',
    };
    showToast(msgs[err.code] || 'Sign in failed. Please try again.', 'error');
  }
});

// ── REGISTER ──
document.getElementById('registerBtn').addEventListener('click', async () => {
  const firstName      = document.getElementById('regFirstName').value.trim();
  const lastName       = document.getElementById('regLastName').value.trim();
  const email          = document.getElementById('regEmail').value.trim();
  const dob            = document.getElementById('regDob').value;
  const nationality    = document.getElementById('regNationality').value;
  const passport       = document.getElementById('regPassport').value.trim();
  const passportExpiry = document.getElementById('regPassportExpiry').value;
  const phone          = document.getElementById('regPhone').value.trim();
  const pass           = document.getElementById('regPass').value;
  const passConfirm    = document.getElementById('regPassConfirm').value;
  const terms          = document.getElementById('regTerms').checked;

  // Validation
  if (!firstName || !lastName)           { showToast('Please enter your full name.', 'error'); return; }
  if (!email)                            { showToast('Please enter your email.', 'error'); return; }
  if (!dob)                              { showToast('Please enter your date of birth.', 'error'); return; }
  if (!nationality)                      { showToast('Please select your nationality.', 'error'); return; }
  if (!phone)                            { showToast('Please enter your phone number.', 'error'); return; }
  if (pass.length < 8)                   { showToast('Password must be at least 8 characters.', 'error'); return; }
  if (pass !== passConfirm)              { showToast('Passwords do not match.', 'error'); return; }
  if (!terms)                            { showToast('Please accept the Terms of Service.', 'error'); return; }

  setLoading('registerBtn', true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    // Save profile to Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      firstName, lastName, email,
      dob, nationality, passport, passportExpiry, phone,
      role: ADMIN_EMAILS.includes(email) ? 'admin' : 'user',
      createdAt: serverTimestamp(),
      marketing: document.getElementById('regMarketing').checked,
    });
    // onAuthStateChanged handles redirect
  } catch(err) {
    setLoading('registerBtn', false);
    const msgs = {
      'auth/email-already-in-use': 'An account with this email already exists.',
      'auth/invalid-email':        'Please enter a valid email address.',
      'auth/weak-password':        'Password is too weak. Use at least 8 characters.',
    };
    showToast(msgs[err.code] || 'Registration failed. Please try again.', 'error');
  }
});

// ── GOOGLE ──
const provider = new GoogleAuthProvider();
document.getElementById('googleBtn').addEventListener('click', async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user   = result.user;
    // Create profile if new user
    const ref  = doc(db, 'users', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const [firstName, ...rest] = (user.displayName || 'User').split(' ');
      await setDoc(ref, {
        firstName, lastName: rest.join(' ') || '',
        email: user.email,
        role: ADMIN_EMAILS.includes(user.email) ? 'admin' : 'user',
        createdAt: serverTimestamp(),
        provider: 'google',
      });
    }
    // Redirect after Google sign-in
    if (user && ADMIN_EMAILS.includes(user.email)) {
      window.location.href = _adminHref();
    } else {
      const dest = sessionStorage.getItem('postLoginRedirect') || '../index.html';
      sessionStorage.removeItem('postLoginRedirect');
      window.location.href = dest;
    }
  } catch(err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      showToast('Google sign-in failed. Please try again.', 'error');
    }
  }
});

// ── Helpers ──
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
  btn.querySelector('span').textContent = loading
    ? (btnId === 'loginBtn' ? 'Signing in' : 'Creating account')
    : (btnId === 'loginBtn' ? 'Sign In' : 'Create Account');
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = type ? `show ${type}` : 'show';
  setTimeout(() => { toast.className = toast.className.replace('show','').trim(); }, 4000);
}
