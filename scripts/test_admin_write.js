const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const admin = require('firebase-admin');

async function main() {
  const defaultPaths = [
    path.join(__dirname, '..', 'service-account.json'),
    path.join(process.env.HOMEDRIVE || 'C:', process.env.HOMEPATH || '\\Users\\Hp', 'service-account.json'),
    path.join('C:', 'Users', 'Hp', 'service-account.json')
  ];
  let keyPath = defaultPaths.find(p => fs.existsSync(p));
  if (!keyPath) {
    console.error('service-account.json not found in expected locations:', defaultPaths);
    process.exit(1);
  }
  const key = require(keyPath);
  admin.initializeApp({ credential: admin.credential.cert(key) });

  const projectId = key.project_id;
  const apiKey = 'AIzaSyA8LBQLRAqtpep1nLuejyHr_qdG0nfAVcU'; // from firebase-config.js
  const adminEmail = 'admin@grandskyairways.com';
  const adminPassword = 'Admin123!';

  // Ensure user exists
  let user;
  try { user = await admin.auth().getUserByEmail(adminEmail); console.log('Admin user exists:', user.uid);
    // ensure password is set to known value for this test
    await admin.auth().updateUser(user.uid, { password: adminPassword });
    console.log('Updated admin user password for test.');
  }
  catch (e) {
    console.log('Creating admin user...');
    user = await admin.auth().createUser({ email: adminEmail, emailVerified: true, password: adminPassword });
    console.log('Created admin user:', user.uid);
  }

  // Sign in with email/password via REST to get idToken
  const signInUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  const signRes = await fetch(signInUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: adminPassword, returnSecureToken: true })
  });
  const signJson = await signRes.json();
  if (!signRes.ok) { console.error('Sign-in failed:', signJson); process.exit(1); }
  const idToken = signJson.idToken;
  console.log('Obtained idToken (length):', idToken ? idToken.length : 0);

  // Attempt to add a test flight document using Firestore REST with Authorization header
  const doc = {
    fields: {
      fromCode: { stringValue: 'TST' },
      toCode: { stringValue: 'TST2' },
      fromCity: { stringValue: 'Testville' },
      toCity: { stringValue: 'Testopolis' },
      price: { integerValue: 1 },
      airline: { stringValue: 'GS' }
    }
  };
  const writeUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/flights`;
  const wRes = await fetch(writeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
    body: JSON.stringify(doc)
  });
  const wJson = await wRes.json();
  if (wRes.ok) {
    console.log('Write succeeded, doc name:', wJson.name);
    // clean up: delete the created doc via Admin SDK
    try {
      const parts = wJson.name.split('/');
      const docId = parts[parts.length-1];
      await admin.firestore().collection('flights').doc(docId).delete();
      console.log('Cleanup: deleted test doc', docId);
    } catch (e) { console.warn('Cleanup failed', e.message); }
  } else {
    console.error('Write failed:', wJson);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
