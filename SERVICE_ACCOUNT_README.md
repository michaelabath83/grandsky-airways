How to get and place your Firebase service account JSON

1. Download the real service account JSON:
- Open the Firebase Console for your project → Settings (gear) → Project settings → Service accounts.
- Click "Generate new private key" and download the JSON file.

2. Move the file into this project (example):
```
Move-Item -Path "C:\Users\Hp\Downloads\your-file.json" -Destination "C:\Users\Hp\Desktop\GrandSky\service-account.json"
```

3. Protect it from git commits:
```
Add-Content -Path .gitignore -Value "service-account.json"
```
If already committed, run:
```
git rm --cached service-account.json
git commit -m "Remove service account from repo"
```

4. Environment variable for current session (PowerShell):
```
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Hp\Desktop\GrandSky\service-account.json"
```

5. Then run the seeder:
```
npm install
npm run seed
```

Important: Never paste or share the file contents publicly. If the key is exposed, revoke it in the Firebase Console and generate a new one.

If you paste the absolute path to your downloaded service-account JSON, I can move it into the project, add it to `.gitignore`, set the env var for this session, run `npm install`, and execute `npm run seed` for you.

Step-by-step: Create a Google Cloud / Firebase service account (console)

1. Open the Google Cloud Console or Firebase Console and select your project.
2. In Firebase Console: Settings (gear) → Project settings → Service accounts.
	- Or in Google Cloud Console: IAM & Admin → Service Accounts.
3. Click **Create Service Account** (or **Generate new private key** in Firebase).
4. Give the service account a descriptive name and ID, then continue.
5. Grant minimal roles required for your use case:
	- For basic Firestore access: `roles/datastore.user` (Firestore user)
	- For admin tasks: `roles/datastore.owner` or `roles/firebase.admin`
	- For Storage access: `roles/storage.objectViewer` or `roles/storage.objectAdmin`
6. Finish creation and, if prompted, download the JSON key (select **JSON** format).
7. Store the JSON locally outside of public repos and follow the steps in this file to place it in the project.

Using the example file in this repo

- `service-account.example.json` is provided as a template. Do NOT copy private key values into it.
- Create a real file named `service-account.json` at the project root (or place your downloaded JSON anywhere and set `GOOGLE_APPLICATION_CREDENTIALS` accordingly).
- Example copy (PowerShell):

```
Move-Item -Path "C:\Users\Hp\Downloads\your-file.json" -Destination "C:\Users\Hp\Desktop\GrandSky\service-account.json"
```

Local test script

- I added a small test script `scripts/test_service_account.js` that initializes `firebase-admin` using the `GOOGLE_APPLICATION_CREDENTIALS` env var (or `service-account.json` in the project root) and lists top-level collections. Run it after setting up credentials to verify access.

Security notes

- Never commit `service-account.json` to source control. Add it to `.gitignore` if you place it in the repo root.
- Rotate keys if they are exposed and use IAM conditions or restricted roles when possible.