async function main(){
  // use Firebase client SDK in Node to sign in and write as client
  const { initializeApp } = await import('firebase/app');
  const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
  const { getFirestore, collection, addDoc } = await import('firebase/firestore');

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
  const auth = getAuth(app);
  const db = getFirestore(app);

  const email = 'admin@grandskyairways.com';
  const password = 'Admin123!';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log('Signed in as', cred.user.email);
    const token = await cred.user.getIdTokenResult();
    console.log('ID token claims:', token.claims);
    console.log('User email (from cred):', cred.user.email);
    const docRef = await addDoc(collection(db,'flights'), { fromCode:'CLI', toCode:'CLI2', price:5, airline:'GS' });
    console.log('Client write succeeded, doc id:', docRef.id);
    await fetch(`https://firestore.googleapis.com/v1/projects/grandsky-airways/databases/(default)/documents/flights/${docRef.id}`, { method:'DELETE', headers:{ Authorization: 'Bearer ' + (await cred.user.getIdToken()) } });
    console.log('Cleanup OK');
  } catch (e) {
    console.error('Client test failed:', e.message || e);
    process.exit(1);
  }
}

main();
