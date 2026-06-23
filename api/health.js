const admin = require('firebase-admin');

let __svc_obj = null;
function initAdmin() {
  if (admin.apps.length) return admin.app();
  let svc = null;
  if (process.env.SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(process.env.SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
      svc = JSON.parse(decoded);
    } catch (e) {
      throw new Error('Invalid SERVICE_ACCOUNT_BASE64: failed to decode/parse JSON');
    }
  } else if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
      svc = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    } catch (e) {
      throw new Error('Invalid SERVICE_ACCOUNT_JSON: failed to parse JSON');
    }
  }

  if (!svc) {
    const svcPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'service-account.json';
    try { svc = require(require('path').resolve(svcPath)); } catch (e) { /* ignore */ }
  }

  if (!svc || typeof svc.project_id !== 'string') {
    throw new Error('Service account not provided or invalid');
  }
  __svc_obj = svc;
  return admin.initializeApp({ credential: admin.credential.cert(svc) });
}

module.exports = async (req, res) => {
  try {
    initAdmin();
    const info = { projectId: (__svc_obj && __svc_obj.project_id) || admin.app().options.projectId || null };
    // attempt a lightweight Firestore read to verify DB permissions
    try {
      const snap = await admin.firestore().collection('bookings').limit(1).get();
      info.bookingsSample = snap.size;
    } catch (e) {
      info.bookingsSample = 'unreadable';
      info.bookingsError = e.message || String(e);
    }
    return res.json({ ok: true, admin: info });
  } catch (err) {
    console.error('health check failed', err);
    return res.status(500).json({ ok: false, error: err.message || String(err) });
  }
};
