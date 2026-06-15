const admin = require('firebase-admin');

async function main() {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } catch (e) {}
  const storage = admin.storage();
  try {
    const [buckets] = await storage.getBuckets();
    console.log('Found buckets:', buckets.map(b => b.name));
  } catch (err) {
    console.error('Error listing buckets:', err.message);
    process.exit(1);
  }
}

main();
