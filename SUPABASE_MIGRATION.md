# Firebase to Supabase + Vercel Migration Guide

## Overview
This project has been migrated from Firebase (Auth + Firestore) to Supabase (PostgreSQL + Auth) with Vercel serverless functions for admin operations.

## Setup Steps

### 1. Supabase Project
1. Create a Supabase project at https://supabase.com
2. Note your project URL and anon/service role API keys
3. Run the migrations:
   - [002_add_profiles_tickets.sql](supabase/migrations/002_add_profiles_tickets.sql)
   - This creates: `profiles`, `bookings`, `payments`, `tickets`, `admin_logs`, `email_queue`, `flights`, `airlines`, `airports`

### 2. Environment Variables
Set these in Vercel:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key (server-side only)
ADMIN_EMAILS=admin@grandskyairways.com,your_email@example.com
```

### 3. Frontend Setup
Update environment variables for your frontend:
- `VITE_SUPABASE_URL` (if using Vite)
- Or inject via `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY`

### 4. Auth Migration
Auth is now handled by Supabase. Key changes:
- Replace Firebase auth calls with Supabase equivalents
- User profiles are stored in `profiles` table (created on signup)
- Admin emails are checked against `ADMIN_EMAILS` from config or env var

### 5. Database Migration (from Firestore)
Export Firestore collections as JSON:
```bash
# Using Firebase CLI
firebase firestore:export --export-path ./firestore-export

# Then convert JSON to Supabase format and insert via admin panel or API
```

OR seed demo data from [firestore-seed/](firestore-seed/) directory.

### 6. Serverless Functions
Deploy `api/` functions to Vercel:
- `api/createBooking.js` - Create booking via Supabase
- `api/admin/approvePayment.js` - Admin: approve payment and issue ticket
- `api/admin/rejectPayment.js` - Admin: reject payment

These use `SUPABASE_SERVICE_ROLE_KEY` (never expose to client).

### 7. Row-Level Security (RLS) Policies
Create RLS policies in Supabase to ensure:
- Users can only read/write their own profiles
- Bookings are readable by user only
- Admin operations require admin role

Example:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_profile" ON profiles FOR ALL
  USING (auth.uid() = id);
```

### 8. Email Queue
`email_queue` table can be polled by a worker/cron job to send emails via:
- SendGrid
- Mailgun
- EmailJS (already integrated in code)

## Key File Changes

### Frontend Auth
- `js/auth.js` - Uses `supabase.auth.signUp/signInWithPassword`
- `js/supabase-config.js` - Exports `supabase` client and `ADMIN_EMAILS`

### Admin Functions
- `api/admin/approvePayment.js` - Verifies token, updates booking status, creates ticket
- `api/admin/rejectPayment.js` - Verifies token, rejects booking, queues rejection email

### Removed
- `firebase-config.js` - No longer exports `auth` (only keeps `db` for now during transition)
- Firebase imports from `firebase-auth.js` and `firebase-firestore.js`

## Migration Checklist

- [x] Auth: Frontend auth flows (signup/signin/logout) → Supabase
- [x] Auth: Admin guard pages → Supabase
- [x] Auth: Add `profiles` table + profile creation on signup
- [x] API: Create serverless endpoints for approve/reject payment
- [x] API: Update admin approve/reject to use serverless
- [ ] Firestore data migration (manual or via script)
- [ ] RLS policies for all tables
- [ ] Email queue worker/cron job
- [ ] Flights/airports data seed to Supabase
- [ ] Frontend: Update home.js to load flights from Supabase
- [ ] Frontend: Update flights.js to query Supabase
- [ ] Remove Firebase SDK references entirely
- [ ] Test full user flow (auth → search → book → payment → admin review)
- [ ] Deploy to Vercel

## Troubleshooting

### Auth token missing
Ensure Supabase auth is initialized and token is passed in `Authorization: Bearer <token>` header to serverless functions.

### RLS blocking writes
Check that RLS policies are permissive for the `service_role` key on admin operations.

### Email queue not processing
Set up a Vercel Cron or external worker to poll `email_queue` table and send via EmailJS/provider.

## Further Documentation
- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/serverless-functions)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
