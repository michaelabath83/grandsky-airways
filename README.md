   
   CLI alternative (paste the base64 string when prompted):
   ```powershell
   npx vercel env add SERVICE_ACCOUNT_BASE64 production
   # choose "Encrypted" then paste the base64 string when asked
   npx vercel env add SERVICE_ACCOUNT_BASE64 preview
   ```
# GrandSky Airways

Simple static site for the GrandSky Airways demo — flights, airports and basic admin UI.

What this repo contains
- Static frontend: HTML, CSS, JS in the project root and `pages/`, `js/`, `css/`.
- Firestore seed JSON in `firestore-seed/` and `data/`.
- Seeder and helper scripts in `scripts/` to push seed data to Firestore.

Security / secrets
- This project uses Firebase Admin locally for seeding. Do NOT commit `service-account.json`.
- A helper `SERVICE_ACCOUNT_README.md` explains how to obtain and use a service account locally.

Preparing for GitHub and Vercel
1. Ensure `service-account.json` is stored outside this repo or kept locally and not committed.
2. `.gitignore` already excludes `service-account.json` and `node_modules`.
3. `.vercelignore` is included to avoid uploading secrets and dev files to Vercel.

Deploying to Vercel
- Recommended: Deploy as a static site. Logos and assets are in `css/assets/` and will be served by Vercel.
- Use `npx vercel` to create a preview deploy and `npx vercel --prod` for production.

Serverless functions and service account (Vercel)
- This project includes serverless endpoints under `api/` (`createBooking.js`, `submitPayment.js`) which use the Firebase Admin SDK and a service account to perform Firestore writes securely from the server side.
- Recommended provisioning: set a Vercel Environment Variable named `SERVICE_ACCOUNT_BASE64` containing the base64-encoded content of your service account JSON (safer for newlines in env vars).

Steps to deploy service account to Vercel:
1. Generate base64 of your service account locally:
   ```powershell
   node scripts\print_service_account_base64.js path\to\grandsky-airways-892399e72df7.json
   ```
   Copy the output string.
2. In your Vercel project settings → Environment Variables, add a variable:
   - Name: `SERVICE_ACCOUNT_BASE64`
   - Value: (paste the string)
   - Environment: `Preview` and `Production` as needed
3. Deploy to Vercel (preview then production) using `npx vercel` and `npx vercel --prod`.

Notes:
- The serverless functions will verify the caller's Firebase ID token (the frontend sends it as `Authorization: Bearer <idToken>`). The functions then perform admin writes using the service account — this avoids exposing Firestore write rules to all authenticated clients.
- If you prefer, you can instead set `SERVICE_ACCOUNT_JSON` to the raw JSON, or set `GOOGLE_APPLICATION_CREDENTIALS` to point to a file in your deployment; `SERVICE_ACCOUNT_BASE64` is recommended for environment variables.

Health-check endpoint
- After deploying, you can verify the service account and Firestore permissions by calling the new serverless endpoint `/api/health`.
- Example (replace `<your-deploy-url>`):
   ```powershell
   curl https://<your-deploy-url>/api/health
   ```
   Expected response: JSON `{ ok: true, admin: { projectId: 'grandsky-airways', bookingsSample: 0 } }` (or sample size)

Seeding Firestore (local)
1. Place service account JSON outside repo and set `GOOGLE_APPLICATION_CREDENTIALS` in PowerShell:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Hp\service-account.json"
   npm install
   npm run seed
   ```

If you want me to initialize a local git repository and create the initial commit, I can do that now.
