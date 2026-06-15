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