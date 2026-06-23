#!/usr/bin/env node

/**
 * Quick Supabase Connection Test
 * Verifies connection to your Supabase project
 * 
 * Usage: node scripts/test_supabase_connection.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZXVpanV6ZmpmZG55cnh2cW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMDExOTEsImV4cCI6MjA5NzY3NzE5MX0.h-jjY8qu5KbCR0zYr6xkmVO8GIajkhB5ZXZ0-2UBecw';

async function testConnection() {
  console.log('🔌 Testing Supabase connection...\n');

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    console.log('✅ Supabase client initialized');
    console.log(`   URL: ${SUPABASE_URL}\n`);

    // Test 1: Check if tables exist
    console.log('📊 Checking database tables...');
    const tables = [
      'profiles',
      'bookings',
      'payments',
      'tickets',
      'admin_logs',
      'email_queue',
      'flights',
      'airlines',
      'airports'
    ];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error && error.code === 'PGRST116') {
          console.log(`   ⚠️  ${table} - NOT FOUND (needs migration)`);
        } else if (error) {
          console.log(`   ⚠️  ${table} - ERROR: ${error.message}`);
        } else {
          console.log(`   ✅ ${table} - Ready (${count} rows)`);
        }
      } catch (err) {
        console.log(`   ❌ ${table} - Exception: ${err.message}`);
      }
    }

    console.log('\n✅ Connection test complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. If tables show "NOT FOUND", run the migration:');
    console.log('      - Copy supabase/migrations/002_add_profiles_tickets.sql');
    console.log('      - Paste into Supabase SQL editor');
    console.log('      - Execute');
    console.log('   2. Then seed demo data: npm run seed:supabase');
    console.log('   3. Deploy to Vercel');

  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\n⚠️  Troubleshooting:');
    console.error('   - Check URL is correct: https://jceuijuzfjfdnyrxvqny.supabase.co');
    console.error('   - Check anon key is valid');
    console.error('   - Ensure npm package installed: npm install @supabase/supabase-js');
    process.exit(1);
  }
}

testConnection();
