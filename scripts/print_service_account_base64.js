// Usage: node print_service_account_base64.js [path-to-service-account.json]
// Produces a base64-encoded version of the service account JSON suitable for pasting into Vercel env vars.

const fs = require('fs');
const path = require('path');

const p = process.argv[2] || 'grandsky-airways-892399e72df7.json';
try {
  const full = path.resolve(p);
  const raw = fs.readFileSync(full, 'utf8');
  // validate JSON
  JSON.parse(raw);
  const b = Buffer.from(raw, 'utf8').toString('base64');
  console.log(b);
} catch (e) {
  console.error('Failed to read/parse service account JSON:', e.message || e);
  process.exit(2);
}
