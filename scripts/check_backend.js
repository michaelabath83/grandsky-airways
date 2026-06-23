#!/usr/bin/env node

// Verify Supabase backend: tables existence, row counts, and storage buckets
// Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, then run

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const tablesToCheck = ['profiles', 'airlines', 'airports', 'flights', 'tickets'];

async function checkTable(name) {
  try {
    // Try to select all rows with exact count — this works regardless of primary key column name
    const { data, error, count, status } = await admin.from(name).select('*', { count: 'exact' });
    if (error) {
      // relation does not exist or permission error
      return { name, exists: false, error: error.message || error };
    }
    return { name, exists: true, count: typeof count === 'number' ? count : (Array.isArray(data) ? data.length : 'unknown') };
  } catch (err) {
    return { name, exists: false, error: err.message || err };
  }
}

async function listBuckets() {
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) return { error: error.message || error };
    return { buckets: data.map(b => ({ name: b.name, public: b.public })) };
  } catch (err) {
    return { error: err.message || err };
  }
}

async function run() {
  console.log('Checking Supabase backend at', SUPABASE_URL);
  const results = [];
  for (const t of tablesToCheck) {
    const r = await checkTable(t);
    results.push(r);
    if (!r.exists) {
      console.log(`- Table ${t}: MISSING`);
    } else if (r.error) {
      console.log(`- Table ${t}: ERROR - ${r.error}`);
    } else {
      console.log(`- Table ${t}: OK — rows: ${r.count}`);
    }
  }

  console.log('\nChecking storage buckets:');
  const buckets = await listBuckets();
  if (buckets.error) {
    console.log('Storage check error:', buckets.error);
  } else {
    console.log('Buckets:');
    buckets.buckets.forEach(b => console.log(` - ${b.name} (public: ${b.public})`));
  }

  console.log('\nBackend verification complete.');
}

run();
