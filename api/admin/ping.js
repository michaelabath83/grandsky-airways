const admin = require('firebase-admin');
const path = require('path');

function loadServiceAccount() {
  let svc = null;
  if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
      svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('Invalid SERVICE_ACCOUNT_JSON: failed to parse JSON');
    }
  }

  if (!svc) {
    const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json';
    try {
      svc = require(path.resolve(svcPath));
    } catch (e) {
      throw new Error('Service account not found. Set SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON file');
    }
  }

  if (!svc || typeof svc.project_id !== 'string') {
    throw new Error('Service account object must contain a string "project_id" property. Ensure your service account JSON is valid');
  }

  return svc;
}

module.exports = async (req, res) => {
  try {
    const svc = loadServiceAccount();
    return res.json({ projectId: svc.project_id });
  } catch (err) {
    console.error('/admin/ping error', err);
    return res.status(500).json({ error: err.message || 'internal' });
  }
};
