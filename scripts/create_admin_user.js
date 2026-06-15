#!/usr/bin/env node
/*
 Safe admin user creation script for GrandSky Airways
 - Uses Firebase Admin SDK with a service account JSON
 - Reads admin email/password from env vars or CLI args (never hardcodes passwords in repo)

 Usage examples:
 1) Unix / WSL / Git Bash:
    export SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
    export ADMIN_PASS="grandsky@1"
    npm run create-admin

 2) PowerShell:
    $env:SERVICE_ACCOUNT_PATH = 'C:\path\to\serviceAccount.json'
    $env:ADMIN_PASS = 'grandsky@1'
    npm run create-admin

 Or pass via CLI:
    node scripts/create_admin_user.js --email admin@grandskyairways.com --password "grandsky@1"
*/

const path = require('path');
const argv = require('minimist')(process.argv.slice(2));

const svcPath = process.env.SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || argv.serviceAccount;
if (!svcPath) {
  console.error('ERROR: Set SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS env var, or pass --serviceAccount');
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = require(path.resolve(svcPath));
} catch (err) {
  console.error('ERROR: Could not load service account JSON at', svcPath);
  console.error(err.message || err);
  process.exit(1);
}

const admin = require('firebase-admin');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const firestore = admin.firestore();

const email = argv.email || process.env.ADMIN_EMAIL || 'admin@grandskyairways.com';
const password = argv.password || process.env.ADMIN_PASS;

if (!password) {
  console.error('ERROR: Provide password via --password or ADMIN_PASS env var');
  process.exit(1);
}

(async () => {
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('User already exists — updating password and admin claim.');
      await admin.auth().updateUser(userRecord.uid, { password });
    } catch (err) {
      console.log('Creating new admin user for', email);
      userRecord = await admin.auth().createUser({ email, password, displayName: 'Admin' });
    }

    // Set custom claims (admin)
    await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });

    // Ensure Firestore profile exists with role
    await firestore.collection('users').doc(userRecord.uid).set({
      email,
      role: 'admin',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log('Admin user is ready:', email);
    console.log('Do NOT commit passwords or service account JSON to the repository.');
    process.exit(0);
  } catch (e) {
    console.error('ERROR creating/updating admin user:', e && e.message ? e.message : e);
    process.exit(1);
  }
})();
