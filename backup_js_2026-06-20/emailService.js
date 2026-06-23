import { db } from './firebase-config.js';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function createEmailQueueEntry(payload) {
  const qRef = await addDoc(collection(db, 'emailQueue'), {
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
    attachmentNote: payload.attachmentNote || null,
    status: 'pending',
    retryCount: 0,
    createdAt: serverTimestamp(),
    sentAt: null,
    error: null
  });
  return qRef;
}

async function sendViaEmailJS(templateParams) {
  // REPLACE SERVICE_ID and TEMPLATE_ID as needed by admin
  if (typeof emailjs === 'undefined') throw new Error('EmailJS not loaded');
  // Example: emailjs.send('service_xxx','template_xxx', templateParams)
  return emailjs.send(templateParams.serviceId || 'YOUR_SERVICE_ID', templateParams.templateId || 'YOUR_TEMPLATE_ID', templateParams);
}

async function sendAndTrack(emailEntryRef, templateParams, retryLimit = 3) {
  try {
    await sendViaEmailJS(templateParams);
    await updateDoc(emailEntryRef, { status: 'sent', sentAt: serverTimestamp(), error: null });
    return true;
  } catch (err) {
    const e = err && err.message ? err.message : String(err);
    try { await updateDoc(emailEntryRef, { status: 'failed', retryCount: (templateParams._retry||0) + 1, error: e }); } catch(eu) {}
    if ((templateParams._retry || 0) < retryLimit) {
      templateParams._retry = (templateParams._retry || 0) + 1;
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const r = await sendAndTrack(emailEntryRef, templateParams, retryLimit);
            resolve(r);
          } catch (err2) { reject(err2); }
        }, 5000);
      });
    }
    throw new Error(e);
  }
}

export async function sendTicketEmail(booking, ticketNumber, pdfBase64) {
  try {
    const to = booking.passenger.email;
    const subject = `Your GrandSky Airways Flight Ticket — ${booking.bookingRef}`;
    const body = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#16191F">
        <h2 style="color:#C6922A">GrandSky Airways</h2>
        <p>Dear ${booking.passenger.firstName},</p>
        <p>Your payment has been confirmed. Your flight details are below.</p>
        <div style="border:1px solid #eee;padding:12px;margin:12px 0;background:#fafafa">
          <p><strong>Ticket No:</strong> ${ticketNumber}</p>
          <p><strong>Booking Ref:</strong> ${booking.bookingRef}</p>
          <p><strong>Route:</strong> ${booking.flight.fromCity} → ${booking.flight.toCity}</p>
          <p><strong>Date:</strong> ${booking.flight.departDate}</p>
          <p><strong>Passenger:</strong> ${booking.passenger.firstName} ${booking.passenger.lastName}</p>
          <p><strong>Cabin:</strong> ${booking.flight.cabinClass}</p>
          <p><strong>Airline:</strong> ${booking.flight.airline}</p>
        </div>
        <p>Please save this email as your ticket. Present it at check-in.</p>
        <p>Thank you for flying with GrandSky Airways.</p>
      </div>
    `;

    const qRef = await createEmailQueueEntry({ to, subject, body, attachmentNote: 'Ticket PDF attached' });

    const templateParams = {
      to_email: to,
      subject,
      html_body: body,
      ticket_number: ticketNumber,
      attachment: pdfBase64,
      serviceId: 'YOUR_SERVICE_ID', // REPLACE THIS
      templateId: 'YOUR_TEMPLATE_ID' // REPLACE THIS
    };

    await sendAndTrack(qRef, templateParams);
    return true;
  } catch (err) {
    console.error('sendTicketEmail failed', err);
    throw err;
  }
}

export async function sendRejectionEmail(booking, rejectionReason) {
  try {
    const to = booking.passenger.email;
    const subject = `Payment Verification Failed — GrandSky Airways ${booking.bookingRef}`;
    const body = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#16191F">
        <h2 style="color:#C6922A">GrandSky Airways</h2>
        <p>Dear ${booking.passenger.firstName},</p>
        <p>We were unable to verify your payment for booking ${booking.bookingRef}.</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        <p>Please contact us at support@grandskyairways.com or resubmit your payment.</p>
        <p>We apologise for any inconvenience.</p>
      </div>
    `;

    const qRef = await createEmailQueueEntry({ to, subject, body, attachmentNote: null });
    const templateParams = { to_email: to, subject, html_body: body, serviceId: 'YOUR_SERVICE_ID', templateId: 'YOUR_TEMPLATE_ID' };
    await sendAndTrack(qRef, templateParams);
    return true;
  } catch (err) {
    console.error('sendRejectionEmail failed', err);
    throw err;
  }
}

export async function sendAdminNotification(booking) {
  try {
    const to = 'admin@grandsky.com';
    const subject = `New Payment Submission — ${booking.bookingRef}`;
    const body = `<p>Payment submitted for booking ${booking.bookingRef}. Please review in the admin dashboard.</p>`;
    const qRef = await createEmailQueueEntry({ to, subject, body, attachmentNote: null });
    const templateParams = { to_email: to, subject, html_body: body, serviceId: 'YOUR_SERVICE_ID', templateId: 'YOUR_TEMPLATE_ID' };
    await sendAndTrack(qRef, templateParams);
    return true;
  } catch (err) {
    console.error('sendAdminNotification failed', err);
    throw err;
  }
}

export default { sendTicketEmail, sendRejectionEmail, sendAdminNotification };
