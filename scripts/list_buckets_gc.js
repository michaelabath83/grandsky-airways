const { Storage } = require('@google-cloud/storage');
const path = require('path');

async function main() {
  const keyPath = path.join(__dirname, '..', 'service-account.json');
  let key;
  try {
    key = require(keyPath);
  } catch (e) {
    console.error('Service account not found at', keyPath);
    process.exit(1);
  }

  const storage = new Storage({ projectId: key.project_id, credentials: key });
  try {
    const [buckets] = await storage.getBuckets();
    console.log('Buckets in project:', buckets.map(b => b.name));
  } catch (err) {
    console.error('Error listing buckets:', err.message);
    process.exit(1);
  }
}

main();
