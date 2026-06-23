#!/usr/bin/env node

// Create a persistent test user via Supabase admin API and print credentials
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const timestamp = Date.now();
  const email = `manual-test+${timestamp}@grandsky.test`;
  const password = 'TestPass123!';

  console.log('Creating test user...');
  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (error) {
      console.error('Create user error:', error.message || error);
      process.exit(1);
    }
    const user = data.user || data;
    console.log('\n✅ Test user created successfully');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('User ID:', user.id || user);
    console.log('\nKeep these credentials safe for testing. To delete the user later run:');
    console.log(`  SUPABASE_SERVICE_ROLE_KEY=... node -e "(async()=>{const c=require('@supabase/supabase-js').createClient('${SUPABASE_URL}', process.env.SUPABASE_SERVICE_ROLE_KEY); await c.auth.admin.deleteUser('${user.id}'); console.log('deleted');})();"`);
  } catch (err) {
    console.error('Error creating test user:', err.message || err);
    process.exit(1);
  }
}

run();
