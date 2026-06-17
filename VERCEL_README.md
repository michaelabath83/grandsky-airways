Vercel serverless endpoints (createBooking / submitPayment)

Purpose
- Provide trusted server-side writes for bookings and payments without requiring Firebase Blaze plan.

Secrets
- SERVICE_ACCOUNT_JSON: The contents of your Firebase service account JSON file (string). Add in Vercel Dashboard → Project → Settings → Environment Variables.

Local testing
- Install Vercel CLI: `npm i -g vercel`
- Run locally: `vercel dev` (it will host /api endpoints)

Endpoints
- POST /api/createBooking
  - Headers: Authorization: Bearer <Firebase ID token>
  - Body: { passenger, flight, payment?, status? }
  - Returns: { bookingId, bookingRef }

- POST /api/submitPayment
  - Headers: Authorization: Bearer <Firebase ID token>
  - Body: { bookingId, coin, walletAddress, cryptoAmount, amountUSD }
  - Returns: { ok: true }

Client integration
- On client, obtain ID token: `const idToken = await auth.currentUser.getIdToken()`
- Use fetch to call endpoints with Authorization header.

Security
- Restrict service account to least privilege (Firestore writer + auth verify if needed).
- Verify ID token server-side (done in the functions) before writing.

Deploy
- Push to your repo and connect to Vercel, or use `vercel` CLI to deploy the project.
