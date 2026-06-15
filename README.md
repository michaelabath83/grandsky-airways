# GrandSky

Simple static site for the GrandSky demo — flights, airports and basic admin UI.

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

Seeding Firestore (local)
1. Place service account JSON outside repo and set `GOOGLE_APPLICATION_CREDENTIALS` in PowerShell:
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Hp\service-account.json"
   npm install
   npm run seed
   ```

If you want me to initialize a local git repository and create the initial commit, I can do that now.
