const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  // Initialize Admin SDK using Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } catch (err) {
    console.error('Failed to initialize Firebase Admin. Make sure GOOGLE_APPLICATION_CREDENTIALS is set.', err.message);
    process.exit(1);
  }

  const db = admin.firestore();
  const seedDir = path.join(__dirname, '..', 'firestore-seed');

  const collections = [
    { name: 'airports', file: 'airports.json', idKey: 'code' },
    { name: 'airlines', file: 'airlines.json', idKey: 'code' },
    { name: 'flights', file: 'flights.json', idKey: null }
  ];

  for (const col of collections) {
    const filePath = path.join(seedDir, col.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Seed file not found: ${filePath}, skipping ${col.name}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    let docs = JSON.parse(raw);
    if (!Array.isArray(docs)) docs = [];

    console.log(`Seeding ${docs.length} documents into collection '${col.name}'`);

    const batchSize = 500;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach((doc) => {
        if (col.idKey && doc[col.idKey]) {
          const docRef = db.collection(col.name).doc(String(doc[col.idKey]));
          batch.set(docRef, doc);
        } else {
          const docRef = db.collection(col.name).doc();
          batch.set(docRef, doc);
        }
      });
      await batch.commit();
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
