Create Admin User

This folder contains a small Node.js script to create or update the admin user in Firebase using the Admin SDK.

Important security notes:
- Do NOT commit service account JSON files or passwords to source control.
- This script reads the service account JSON and password from environment variables or CLI args.

Prerequisites
1. Node.js installed
2. A Firebase service account JSON (from Firebase Console -> Project Settings -> Service accounts)

Install

npm install

Usage (example)

# Unix / WSL / Git Bash
export SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
export ADMIN_PASS="grandsky@1"
npm run create-admin

# PowerShell
$env:SERVICE_ACCOUNT_PATH = 'C:\path\to\serviceAccount.json'
$env:ADMIN_PASS = 'grandsky@1'
npm run create-admin

Or pass via CLI:

node scripts/create_admin_user.js --serviceAccount C:\path\to\serviceAccount.json --email admin@grandskyairways.com --password "grandsky@1"

The script will create the user if it does not exist or update the password and set the `admin` custom claim if it does.
