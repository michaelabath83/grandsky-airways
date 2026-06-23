# GrandSky Airways - Vercel Deployment Checklist

## Pre-Deployment: Supabase Setup

### 1. Supabase Project Configuration
- [ ] Create Supabase project at https://supabase.com
- [ ] Note project URL and API keys
- [ ] Run migration: `supabase/migrations/002_add_profiles_tickets.sql`
- [ ] Verify tables created: profiles, bookings, payments, tickets, admin_logs, email_queue, flights, airlines, airports

### 2. Configure Row-Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Example RLS policy for profiles (users can only read their own profile)
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL USING (auth.uid() = id);

-- Bookings: users can read only their own
CREATE POLICY "users_own_bookings" ON bookings
  FOR ALL USING (auth.uid() = passenger_id);

-- Admin operations require service_role (not exposed to client)
-- No policies needed here; serverless endpoints use service_role key
```

### 3. Seed Demo Data

**Option A: Manual via Supabase Dashboard**
- Import JSON files from `firestore-seed/` directory
- Tables: airlines.json, airports.json, flights.json

**Option B: SQL Scripts**
```bash
cd supabase/migrations
# Run any seed data scripts in Supabase SQL editor
```

### 4. Configure Authentication

- [ ] Enable Email/Password auth in Supabase
- [ ] Enable Google OAuth:
  - Get Google OAuth credentials from Google Cloud Console
  - Add to Supabase Auth settings
  - Whitelist redirect URLs: `https://yourdomain.com/pages/login.html`

### 5. Prepare Environment Variables

Collect these values:
- `SUPABASE_URL` - From Supabase project settings
- `SUPABASE_ANON_KEY` - From Supabase project settings (safe for frontend)
- `SUPABASE_SERVICE_ROLE_KEY` - From Supabase project settings (server-side only!)
- `ADMIN_EMAILS` - Comma-separated list of admin email addresses

## Vercel Deployment

### 1. Connect Repository
- [ ] Push code to GitHub/GitLab
- [ ] Connect Vercel to your repository
- [ ] Select GrandSky folder as root

### 2. Environment Variables in Vercel
In Vercel project settings → Environment Variables, add:

```
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
ADMIN_EMAILS = admin@grandskyairways.com,yourname@example.com
```

**Important:** Mark SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAILS as "Encrypted" if available.

### 3. Frontend Environment
Update `index.html` or create `.env.production`:

```javascript
// In pages that need Supabase (injected by Vercel)
window.SUPABASE_URL = process.env.SUPABASE_URL;
window.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
```

Or directly in `js/supabase-config.js`:
```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
```

### 4. Deploy
- [ ] Push to main branch or trigger manual deploy in Vercel
- [ ] Wait for build to complete
- [ ] Check deployment logs for errors
- [ ] Note production URL

## Post-Deployment: Verification

### 1. Basic Functionality Tests

**Homepage:**
- [ ] Page loads without errors
- [ ] Airports autocomplete displays data
- [ ] Featured destinations load from Supabase
- [ ] User can log in / sign up

**Flight Search:**
- [ ] Can search for flights
- [ ] Results display from Supabase flights table
- [ ] Booking flow accessible

**Payment:**
- [ ] Passenger form submits
- [ ] Booking created in Supabase `bookings` table
- [ ] Booking reference displayed

**Awaiting Page:**
- [ ] Booking status updates in real-time (after admin approves)
- [ ] Uses Supabase real-time subscriptions

**Admin Panel:**
- [ ] Only admin emails can access (redirects to login)
- [ ] Flights/Bookings/Users/Payments tabs load
- [ ] Can approve payment (creates ticket in `tickets` table)
- [ ] Can reject payment (updates booking status)

### 2. Integration Tests

```bash
# Test user signup
curl -X POST https://yourdomain.com/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test flight search
curl https://yourdomain.com/pages/flights.html?from=LAX&to=NYC

# Test admin approve (requires Bearer token)
curl -X POST https://yourdomain.com/api/admin/approvePayment.js \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bookingId":1}'
```

### 3. Verify Serverless Functions

- [ ] `/api/admin/approvePayment.js` - Returns 200 on valid request
- [ ] `/api/admin/rejectPayment.js` - Returns 200 on valid request
- [ ] Both functions validate JWT token
- [ ] Both functions check admin email
- [ ] Email queue entries created in Supabase

### 4. Check Logs

- [ ] Vercel build logs: no errors
- [ ] Vercel function logs: no 500 errors
- [ ] Supabase logs: no SQL errors
- [ ] Browser console: no JavaScript errors

## Optional: Email Service Setup

### Email Queue Worker
Set up a worker to process `email_queue` table:

**Option 1: Supabase Cron Function**
```sql
-- Create a function to process email queue
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS void AS $$
BEGIN
  -- Query email_queue where sent_at is null
  -- Send via EmailJS or provider
  -- Update email_queue.sent_at timestamp
END;
$$ LANGUAGE plpgsql;

-- Schedule to run every 5 minutes
-- (Currently requires external cron service)
```

**Option 2: External Worker (e.g., Vercel Cron)**
```javascript
// api/cron/processEmailQueue.js
export default async function handler(req, res) {
  if (req.query.token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const { data } = await supabase
    .from('email_queue')
    .select('*')
    .is('sent_at', null)
    .limit(10);
  
  for (const email of data) {
    try {
      await sendViaEmailJS(email);
      await supabase.from('email_queue').update({ sent_at: new Date() }).eq('id', email.id);
    } catch (err) {
      console.error('Email send failed:', err);
    }
  }
  
  res.json({ processed: data.length });
}
```

## Rollback Plan

If deployment fails:

1. **Immediate Rollback:** Vercel automatically keeps previous deployments
   - Go to Vercel project → Deployments
   - Click "Promote" on previous stable version

2. **Database Rollback:** Supabase keeps backup of data
   - Supabase dashboard → Backups
   - Restore from previous snapshot if needed

3. **API Fallback:** If serverless functions fail
   - Check `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env
   - Verify function code at `/api/admin/*`
   - Check Supabase RLS policies allow service_role writes

## Success Criteria

✅ Users can sign up with email/password  
✅ Users can sign in with Google  
✅ Flight search returns data from Supabase  
✅ Booking flow creates entries in `bookings` table  
✅ Admin can approve/reject payments  
✅ Admin approve creates `tickets` and queues email  
✅ Awaiting page shows real-time booking status  
✅ No JavaScript errors in browser console  
✅ No 500 errors in Vercel function logs  
✅ Email queue processes successfully  

## Support & Troubleshooting

See [SUPABASE_MIGRATION.md](SUPABASE_MIGRATION.md) and [MIGRATION_COMPLETE.md](MIGRATION_COMPLETE.md) for detailed troubleshooting.
