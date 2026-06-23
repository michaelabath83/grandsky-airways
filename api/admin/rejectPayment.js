import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Supabase env not configured');
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    // verify token and get user
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData || !userData.user) return res.status(401).json({ error: 'Invalid token' });
    const user = userData.user;

    const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@grandskyairways.com').split(',').map(s=>s.trim());
    if (!ADMIN_EMAILS.includes(user.email)) return res.status(403).json({ error: 'Forbidden' });

    const { bookingId, reason } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'Missing bookingId' });
    if (!reason) return res.status(400).json({ error: 'Missing reason' });

    const bookingQ = await sb.from('bookings').select('*').eq('id', bookingId).single();
    if (bookingQ.error || !bookingQ.data) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookingQ.data;

    // update booking status
    const upd = await sb.from('bookings').update({ status: 'payment_rejected' }).eq('id', bookingId);
    if (upd.error) throw upd.error;

    // update payments
    const payUpd = await sb.from('payments').update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString(), reviewed_by: user.email }).eq('booking_id', bookingId);
    if (payUpd.error) throw payUpd.error;

    // admin log
    await sb.from('admin_logs').insert([{ action: 'REJECT_PAYMENT', booking_ref: booking.booking_ref||'', admin_email: user.email, details: `Rejected: ${reason}` }]);

    // enqueue rejection email
    const subject = `Payment Verification Failed — GrandSky Airways ${booking.booking_ref || ''}`;
    const body = { html: `<p>Your payment was rejected. Reason: ${reason}</p>` };
    await sb.from('email_queue').insert([{ to_email: booking.passenger_email || (booking.passenger && booking.passenger.email) || '', subject, body }]);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('rejectPayment error', err);
    return res.status(500).json({ error: String(err) });
  }
}
