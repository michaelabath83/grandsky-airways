#!/usr/bin/env node

// Test sign-in flow
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
  const testEmail = `test+${Date.now()}@grandsky.test`;
  const testPassword = 'TestPass123!';
  
  console.log('1. Creating test user with admin client...');
  try {
    const { data: userData, error: createErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true
    });
    if (createErr) throw createErr;
    const userId = userData.user.id;
    console.log('✅ User created:', userId);

    console.log('\n2. Checking if profile was auto-created...');
    const { data: profileData, error: profileErr } = await admin.from('profiles').select('*').eq('id', userId).single();
    if (profileErr) {
      console.log('❌ Profile check error:', profileErr.message);
    } else if (profileData) {
      console.log('✅ Profile exists:', profileData);
    } else {
      console.log('❌ No profile found');
    }

    console.log('\n3. Attempting sign-in with anon client...');
    const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (signInErr) {
      console.log('❌ Sign-in error:', signInErr.message);
    } else if (signInData?.user) {
      console.log('✅ Sign-in successful:', signInData.user.id);
    } else {
      console.log('❌ No user returned from sign-in');
    }

    console.log('\n4. Cleaning up...');
    await admin.auth.admin.deleteUser(userId);
    console.log('✅ Test user deleted');

  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
}

run();
