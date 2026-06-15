const admin = require('firebase-admin');

async function main() {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } catch (err) {
    // already initialized in some environments
  }

  const db = admin.firestore();
  const collections = await db.listCollections();
  console.log(`Found ${collections.length} top-level collections:`);

  for (const col of collections) {
    const snap = await db.collection(col.id).get();
    console.log(`- ${col.id}: ${snap.size} documents`);
    snap.docs.slice(0, 5).forEach((d, i) => {
      console.log(`  sample ${i + 1}: id=${d.id} ->`, d.data());
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
