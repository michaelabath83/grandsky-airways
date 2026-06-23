# Vercel Environment Variables Setup Guide

## Your Supabase Credentials

Your Supabase project is already configured. Here are the credentials to use:

```
Project URL: https://jceuijuzfjfdnyrxvqny.supabase.co
```

---

## Step 1: Add Environment Variables to Vercel

### Frontend Variables (safe to expose)
These use public keys limited by RLS policies:

```
SUPABASE_URL=https://jceuijuzfjfdnyrxvqny.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXVpanV6ZmpmZG55cnh2cW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDExOTEsImV4cCI6MjA5NzY3NzE5MX0.h-jjY8qu5KbCR0zYr6xkmVO8GIajkhB5ZXZ0-2UBecw
```

### Backend Variables (KEEP SECURE)
These are used by Vercel serverless functions for admin operations:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXVpanV6ZmpmZG55cnh2cW55Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjEwMTE5MSwiZXhwIjoyMDk3Njc3MTkxfQ.5jmtiKcm9s6Wy9iF14K6GBdd3cmY4eWxsOm8JY5nGRI
ADMIN_EMAILS=admin@grandskyairways.com,michaelabath83@gmail.com
```

---

## Step 2: How to Set Variables in Vercel

### Option A: Vercel Dashboard (Recommended for UI)

1. Go to your Vercel project: https://vercel.com/dashboard
2. Click on your GrandSky Airways project
3. Go to **Settings** → **Environment Variables**
4. Add each variable:
   - **Name:** `SUPABASE_URL`
   - **Value:** `https://jceuijuzfjfdnyrxvqny.supabase.co`
   - **Environments:** Production, Preview, Development
   - Click **Add**

5. Repeat for `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`

### Option B: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Link to Vercel project
vercel link

# Set environment variables
vercel env add SUPABASE_URL
# Paste: https://jceuijuzfjfdnyrxvqny.supabase.co

vercel env add SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

vercel env add SUPABASE_SERVICE_ROLE_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

vercel env add ADMIN_EMAILS
# Paste: admin@grandskyairways.com,michaelabath83@gmail.com
```

### Option C: vercel.json (with secrets)

Create or update `vercel.json`:

```json
{
  "env": {
    "SUPABASE_URL": "https://jceuijuzfjfdnyrxvqny.supabase.co",
    "SUPABASE_ANON_KEY": "@supabase_anon_key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase_service_role_key",
    "ADMIN_EMAILS": "admin@grandskyairways.com,michaelabath83@gmail.com"
  }
}
```

Then reference secrets with `@` prefix via Vercel dashboard.

---

## Step 3: Verify Configuration

After adding environment variables, redeploy:

```bash
vercel deploy --prod
```

Check the deployment logs to ensure:
- ✅ `SUPABASE_URL` is set
- ✅ `SUPABASE_ANON_KEY` is set
- ✅ `SUPABASE_SERVICE_ROLE_KEY` is set (backend only)
- ✅ `ADMIN_EMAILS` is set

---

## Step 4: Test the Deployment

```bash
# Test frontend loads
curl https://your-vercel-url.vercel.app/

# Test serverless function
curl -X POST https://your-vercel-url.vercel.app/api/admin/approvePayment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"bookingId":1}'
```

---

## Important Security Notes

⚠️ **DO NOT:**
- Commit `SUPABASE_SERVICE_ROLE_KEY` to git
- Share service role key publicly
- Expose admin emails in frontend code
- Push `.env.production.local` to repository

✅ **DO:**
- Keep `.env.production.local` in `.gitignore`
- Use Vercel secrets for sensitive values
- Rotate keys if compromised
- Store service role key only on backend (Vercel functions)

---

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
```bash
# Install Supabase client in Vercel functions
cd api
npm install @supabase/supabase-js
cd ..
```

### "Auth token missing" on admin endpoints
Ensure frontend sends JWT in Authorization header:
```javascript
const { data } = await supabase.auth.getSession();
const token = data.session.access_token;
fetch('/api/admin/approvePayment', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### "Service role key not set"
Check Vercel environment variables are deployed:
```bash
vercel env list
vercel deploy --prod --yes
```

---

## Next Steps

1. ✅ Add environment variables to Vercel (see above)
2. ✅ Redeploy to Vercel: `vercel deploy --prod`
3. ✅ Test serverless endpoints
4. ✅ Verify admin panel works
5. ✅ Test full booking flow

---

**Your Supabase project is ready! Follow the steps above to complete Vercel deployment.**
