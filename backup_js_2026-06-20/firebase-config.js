// =============================================
// GrandSky Airways — Firebase Configuration
// =============================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project named "grandsky-airways"
// 3. Enable Firestore Database (test mode to start)
// 4. Enable Authentication → Email/Password
// 5. Register a Web App and replace the config below

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8LBQLRAqtpep1nLuejyHr_qdG0nfAVcU",
  authDomain: "grandsky-airways.firebaseapp.com",
  projectId: "grandsky-airways",
  storageBucket: "grandsky-airways.firebasestorage.app",
  messagingSenderId: "7331093453",
  appId: "1:7331093453:web:a296a9927a9078ce8f8284",
  measurementId: "G-R81YNW0BB9"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Admin emails — add your email here to get admin access
// Add your admin email addresses here so the admin UI grants access
export const ADMIN_EMAILS = ["admin@grandskyairways.com", "michaelabath83@gmail.com"];

// Initialize EmailJS (REPLACE THIS with your EmailJS public key)
try {
  if (typeof emailjs !== 'undefined' && emailjs && typeof emailjs.init === 'function') {
    // REPLACE THIS: insert your EmailJS public key string
    emailjs.init('YOUR_EMAILJS_PUBLIC_KEY');
  }
} catch (e) {
  // emailjs not loaded yet — pages that use emailService will ensure the CDN is loaded
}
