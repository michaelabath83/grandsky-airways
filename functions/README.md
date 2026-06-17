# Firebase Functions — GrandSky

This folder contains a minimal Cloud Functions implementation to securely create bookings from the client.

Setup

1. Install dependencies inside the `functions` folder:

```bash
cd functions
npm install
```

2. Deploy (requires Firebase CLI configured):

```bash
firebase deploy --only functions:createBooking
```

Local emulator (recommended for testing):

```bash
# from project root
firebase emulators:start --only functions,firestore,auth
```

Usage

Call the callable from the client using Firebase Functions SDK (`httpsCallable`) and pass a sanitized payload. The callable will verify authentication and write the booking, payments and emailQueue entries server-side.
