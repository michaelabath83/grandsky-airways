const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

async function main() {
  try {
    admin.initializeApp({ credential: admin.credential.applicationDefault(), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
  } catch (err) {}

  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const logosDir = path.join(__dirname, '..', 'firestore-seed', 'logos');

  if (!fs.existsSync(logosDir)) {
    console.error('Logos directory not found:', logosDir);
    process.exit(1);
  }

  const files = fs.readdirSync(logosDir).filter(f => /\.svg$/i.test(f));
  if (!files.length) {
    console.error('No SVG files found in', logosDir);
    process.exit(1);
  }

  for (const file of files) {
    const localPath = path.join(logosDir, file);
    const dest = `airlines/${file}`;
    console.log('Uploading', file, 'to', dest);
    await bucket.upload(localPath, { destination: dest, metadata: { contentType: 'image/svg+xml' } });
    const uploadedFile = bucket.file(dest);
    try {
      await uploadedFile.makePublic();
    } catch (e) {
      console.warn('makePublic failed (check permissions):', e.message);
    }
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    const code = path.basename(file, path.extname(file));
    console.log(`Updating airline doc ${code} with logo URL ${publicUrl}`);
    await db.collection('airlines').doc(code).set({ logo: publicUrl }, { merge: true });
  }

  console.log('Logo upload and updates complete.');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
