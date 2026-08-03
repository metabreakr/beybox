// RLS verification script — uses the app's own Supabase client (anon key).
// Signs in as a second account and attempts three prohibited operations,
// printing exactly what the database returns for each.
//
// Usage:  node verify-rls.mjs <email> <password> <target_user_id>
//   email/password  — credentials of the SECOND account (the attacker)
//   target_user_id  — the first account's profile id to attempt to read

import { createClient } from '@supabase/supabase-js';

const [,, email, password, targetUserId] = process.argv;

if (!email || !password || !targetUserId) {
  console.error('Usage: node verify-rls.mjs <email> <password> <target_user_id>');
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function main() {
  // --- Sign in as the second account (attacker) ---
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.log('=== SIGN IN ===');
    console.log('FAILED:', signInError.message);
    process.exit(1);
  }
  const myId = signInData.user.id;
  console.log('Signed in as:', signInData.user.email, '(id:', myId, ')');
  console.log('Target user id:', targetUserId);
  console.log('');

  // --- 1. Try to read the first account's profiles row ---
  console.log('=== 1. SELECT target user profile ===');
  const { data: readData, error: readError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId);
  console.log('data:', JSON.stringify(readData, null, 2));
  console.log('error:', readError ? JSON.stringify(readError, null, 2) : 'null');
  console.log('');

  // --- 2. Try to update own role to superadmin ---
  console.log('=== 2. UPDATE own role to superadmin ===');
  const { data: roleData, error: roleError } = await supabase
    .from('profiles')
    .update({ role: 'superadmin' })
    .eq('id', myId)
    .select();
  console.log('data:', JSON.stringify(roleData, null, 2));
  console.log('error:', roleError ? JSON.stringify(roleError, null, 2) : 'null');
  console.log('');

  // --- 3. Try to update own plan to pro ---
  console.log('=== 3. UPDATE own plan to pro ===');
  const { data: planData, error: planError } = await supabase
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', myId)
    .select();
  console.log('data:', JSON.stringify(planData, null, 2));
  console.log('error:', planError ? JSON.stringify(planError, null, 2) : 'null');
  console.log('');

  // --- 4. Control: update own display_name (should succeed) ---
  console.log('=== 4. CONTROL: UPDATE own display_name ===');
  const { data: nameData, error: nameError } = await supabase
    .from('profiles')
    .update({ display_name: 'RLS Tester' })
    .eq('id', myId)
    .select();
  console.log('data:', JSON.stringify(nameData, null, 2));
  console.log('error:', nameError ? JSON.stringify(nameError, null, 2) : 'null');

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
