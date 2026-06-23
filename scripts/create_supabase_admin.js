/**
 * Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env, then:
 * node scripts/create_supabase_admin.js admin@domain.com secretPassword
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) { console.error('Usage: node create_supabase_admin.js email password'); process.exit(1); }
  try {
    const res = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    console.log('Admin created:', res.user?.id || '(no id returned)');
  } catch (err) {
    console.error('Failed creating admin', err);
  }
}
main();
