import { db } from './firebase-config.js';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, updateDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { sendTicketEmail, sendRejectionEmail } from './emailService.js';

// Generate ticket number: GSA-TKT-XXXXXXXX
function genTicketNumber() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i=0;i<8;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return 'GSA-TKT-' + s;
}

async function generatePdf(booking, ticketNumber) {
  // Load jsPDF via dynamic import if needed (page should include CDN script)
  try {
    // eslint-disable-next-line no-undef
    const { jsPDF } = window.jspdf || {};
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor('#C6922A');
    doc.text('GrandSky Airways', 20, 20);
    doc.setTextColor(20,20,20);
    doc.setFontSize(12);
    doc.text(`Ticket: ${ticketNumber}`, 20, 36);
    doc.text(`Booking Ref: ${booking.bookingRef || ''}`, 20, 44);
    const pax = booking.passenger || {};
    doc.text(`Passenger: ${pax.firstName || ''} ${pax.lastName || ''}`, 20, 54);
    const f = booking.flight || {};
    doc.setFontSize(16);
    doc.text(`${f.fromCode || ''} → ${f.toCode || ''}`, 20, 74);
    doc.setFontSize(12);
    doc.text(`${f.fromCity || ''} → ${f.toCity || ''}`, 20, 82);
    doc.text(`Departure: ${f.departDate || ''} ${f.dep || ''}`, 20, 92);
    doc.text(`Airline: ${f.airline || ''} · Class: ${f.cabinClass || ''} · Pax: ${f.pax || 1}`, 20, 102);
    doc.text(`Stops: ${f.stops || 0}`, 20, 112);
    doc.text('Thank you for flying with GrandSky Airways', 20, 140);

    const dataUri = doc.output('datauristring'); // data:application/pdf;base64,...
    const base64 = dataUri.split(',')[1];
    return { base64, blob: null };
  } catch (err) {
    throw new Error('PDF generation failed: ' + err.message);
  }
}

export async function approvePayment(bookingId, adminEmail) {
  try {
    const bRef = doc(db, 'bookings', bookingId);
    const bSnap = await getDoc(bRef);
    if (!bSnap.exists()) throw new Error('Booking not found');
    const booking = bSnap.data();
    if (booking.status === 'payment_approved' || booking.status === 'ticket_sent') throw new Error('Already processed');

    const ticketNumber = genTicketNumber();
    const pdf = await generatePdf(booking, ticketNumber);

    // Find payment doc for bookingId
    const pq = query(collection(db, 'payments'), where('bookingId', '==', bookingId));
    const pDocs = await getDocs(pq);
    const batch = writeBatch(db);

    // Prepare ticket doc
    const ticketRef = doc(collection(db, 'tickets'));
    const ticketData = {
      bookingId,
      bookingRef: booking.bookingRef || '',
      ticketNumber,
      passenger: booking.passenger || {},
      flight: booking.flight || {},
      issuedAt: serverTimestamp(),
      issuedBy: adminEmail,
      pdfGenerated: true,
      emailSent: false,
      emailSentAt: null
    };
    batch.set(ticketRef, ticketData);

    // Update booking
    batch.update(bRef, {
      status: 'payment_approved',
      'payment.reviewedAt': serverTimestamp(),
      'payment.reviewedBy': adminEmail,
      updatedAt: serverTimestamp()
    });

    // Update payments
    pDocs.forEach(pd => {
      batch.update(doc(db, 'payments', pd.id), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminEmail
      });
    });

    // Admin log
    const logRef = doc(collection(db, 'adminLogs'));
    batch.set(logRef, {
      action: 'APPROVE_PAYMENT',
      bookingRef: booking.bookingRef || '',
      adminEmail,
      timestamp: serverTimestamp(),
      details: `Approved payment and issued ticket ${ticketNumber}`
    });

    // Commit batch
    await batch.commit();

    // Send email (this also updates emailQueue inside emailService)
    await sendTicketEmail(booking, ticketNumber, pdf.base64);

    // After email sent, update booking -> ticket_sent and ticket doc email fields
    await updateDoc(bRef, { status: 'ticket_sent', updatedAt: serverTimestamp() });
    await updateDoc(ticketRef, { emailSent: true, emailSentAt: serverTimestamp() });

    return { success: true, ticketNumber };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function rejectPayment(bookingId, adminEmail, rejectionReason) {
  if (!rejectionReason || !rejectionReason.trim()) throw new Error('Rejection reason required');
  try {
    const bRef = doc(db, 'bookings', bookingId);
    const bSnap = await getDoc(bRef);
    if (!bSnap.exists()) throw new Error('Booking not found');
    const booking = bSnap.data();

    // find payment
    const pq = query(collection(db, 'payments'), where('bookingId', '==', bookingId));
    const pDocs = await getDocs(pq);
    const batch = writeBatch(db);

    batch.update(bRef, {
      status: 'payment_rejected',
      'payment.reviewedAt': serverTimestamp(),
      'payment.reviewedBy': adminEmail,
      updatedAt: serverTimestamp()
    });

    pDocs.forEach(pd => {
      batch.update(doc(db, 'payments', pd.id), {
        status: 'rejected',
        rejectionReason,
        reviewedAt: serverTimestamp(),
        reviewedBy: adminEmail
      });
    });

    const logRef = doc(collection(db, 'adminLogs'));
    batch.set(logRef, {
      action: 'REJECT_PAYMENT',
      bookingRef: booking.bookingRef || '',
      adminEmail,
      timestamp: serverTimestamp(),
      details: `Rejected payment: ${rejectionReason}`
    });

    await batch.commit();

    // enqueue and send rejection email
    await sendRejectionEmail(booking, rejectionReason);

    return { success: true };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export default { approvePayment, rejectPayment };
