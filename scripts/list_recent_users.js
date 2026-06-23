#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jceuijuzfjfdnyrxvqny.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_SERVICE_ROLE_KEY) { console.error('Please set SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run(){
  try{
    const res = await admin.auth.admin.listUsers(100);
    console.log('Raw response:', JSON.stringify(res, null, 2));
    if (res.error) { console.error('listUsers error:', res.error); process.exit(1); }
    const users = (res.data && res.data.users) || res.users || res.data || res;
    if (!users) { console.log('No users found in response'); process.exit(0); }
    const list = Array.isArray(users) ? users : (users.users || users.data || []);
    console.log('Users count (approx):', list.length);
    list.slice(0,20).forEach(u => console.log(u?.id, u?.email, u?.email_confirmed_at || u?.confirmed_at || u?.created_at));
  }catch(err){ console.error(err); process.exit(1); }
}
run();
