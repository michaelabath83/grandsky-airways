#!/usr/bin/env node

// Test create account and sign-in flow using Supabase admin and anon clients
// Usage: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY in env then run

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY in environment');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
  const email = `test+${Date.now()}@grandsky.test`;
  const password = 'TestPassw0rd!';
  console.log('Creating test user:', email);
  try {
    const { data: createData, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createErr) throw createErr;
    const user = createData.user || createData;
    console.log('User created:', user.id || user);

    // Attempt sign in with anon client
    console.log('Attempting sign-in with anon client...');
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr) {
      console.error('Sign-in failed:', signInErr.message || signInErr);
    } else if (signInData?.user) {
      console.log('Sign-in successful. User ID:', signInData.user.id);
    } else {
      console.log('Sign-in response:', signInData);
    }

    // Clean up: delete user
    console.log('Deleting test user...');
    await admin.auth.admin.deleteUser(user.id || user);
    console.log('Deleted. Test complete.');
  } catch (err) {
    console.error('Error during test:', err.message || err);
    process.exit(1);
  }
}

run();
