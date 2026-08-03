// Verifies the sign-up starter seed by creating a fresh account through the
// real auth API (the same path a reviewer's browser takes), then reading the
// inventory / builds / decks as that user via the anon key with a session.
//
// Usage:  node scripts/verify-starter.mjs
// Prints what the database returned for each check and exits non-zero on any
// mismatch.

import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

async function loadEnv(path) {
  const txt = await readFile(path, 'utf8');
  const env = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = await loadEnv(join(ROOT, '.env'));
const supabaseUrl = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXPECTED_PART_IDS = [
  'DRANSWORD', '3-60', 'F',
  'WIZARDARROW', '4-80', 'B',
  'KNIGHTLANCE', '4-60', 'GB',
];

function fail(msg) {
  console.error('FAIL:', msg);
  process.exitCode = 1;
}

async function main() {
  const suffix = randomBytes(4).toString('hex');
  const email = `starter-test-${suffix}@beybox.test`;
  const password = 'Beybox-Test-9472!';

  // --- Sign up a fresh account (exercises the trigger) ---
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: 'Starter Tester' } },
  });
  if (signUpError) {
    fail('signUp failed: ' + signUpError.message);
    return;
  }
  const userId = signUpData.user?.id;
  if (!userId) {
    fail('signUp returned no user id');
    return;
  }
  console.log('Signed up:', email, '(id:', userId + ')');

  // --- Inventory ---
  const { data: inv, error: invErr } = await supabase
    .from('inventory')
    .select('part_id, quantity')
    .eq('user_id', userId);
  if (invErr) { fail('inventory read failed: ' + invErr.message); return; }
  const invIds = (inv ?? []).map((r) => r.part_id).sort();
  const expectedSorted = [...EXPECTED_PART_IDS].sort();
  console.log('\n=== INVENTORY ===');
  console.log('count:', inv?.length, '(expected 9)');
  if (inv?.length !== 9) fail('inventory count = ' + inv?.length + ', expected 9');
  const allQtyOne = (inv ?? []).every((r) => r.quantity === 1);
  if (!allQtyOne) fail('not all inventory rows have quantity 1');
  const idsMatch = JSON.stringify(invIds) === JSON.stringify(expectedSorted);
  if (!idsMatch) {
    fail('inventory part ids mismatch\n  got: ' + JSON.stringify(invIds) +
      '\n  expected: ' + JSON.stringify(expectedSorted));
  }
  console.log('ids match expected:', idsMatch);
  console.log('all quantities = 1:', allQtyOne);

  // --- Builds ---
  const { data: builds, error: buildErr } = await supabase
    .from('builds')
    .select('id, name, blade_id, ratchet_id, bit_id')
    .eq('user_id', userId);
  if (buildErr) { fail('builds read failed: ' + buildErr.message); return; }
  console.log('\n=== BUILDS ===');
  console.log('count:', builds?.length, '(expected 3)');
  if (builds?.length !== 3) fail('builds count = ' + builds?.length + ', expected 3');
  const expectedBuilds = [
    { name: 'Dran Sword',    blade: 'DRANSWORD',   ratchet: '3-60', bit: 'F' },
    { name: 'Wizard Arrow',  blade: 'WIZARDARROW', ratchet: '4-80', bit: 'B' },
    { name: 'Knight Lance',  blade: 'KNIGHTLANCE', ratchet: '4-60', bit: 'GB' },
  ];
  const byName = new Map((builds ?? []).map((b) => [b.name, b]));
  for (const eb of expectedBuilds) {
    const b = byName.get(eb.name);
    if (!b) { fail('missing build "' + eb.name + '"'); continue; }
    const ok = b.blade_id === eb.blade && b.ratchet_id === eb.ratchet && b.bit_id === eb.bit;
    if (!ok) {
      fail('build "' + eb.name + '" parts mismatch: got ' +
        [b.blade_id, b.ratchet_id, b.bit_id].join('/') +
        ', expected ' + [eb.blade, eb.ratchet, eb.bit].join('/'));
    }
    console.log('  ', eb.name.padEnd(14), ok ? 'OK' : 'MISMATCH',
      '->', [b.blade_id, b.ratchet_id, b.bit_id].join(' + '));
  }

  // --- Decks + deck_builds ---
  const { data: decks, error: deckErr } = await supabase
    .from('decks')
    .select('id, name')
    .eq('user_id', userId);
  if (deckErr) { fail('decks read failed: ' + deckErr.message); return; }
  console.log('\n=== DECKS ===');
  console.log('count:', decks?.length, '(expected 2)');
  if (decks?.length !== 2) fail('decks count = ' + decks?.length + ', expected 2');
  const deckById = new Map((decks ?? []).map((d) => [d.id, d.name]));

  const { data: dbuilds, error: dbErr } = await supabase
    .from('deck_builds')
    .select('deck_id, build_id, position');
  if (dbErr) { fail('deck_builds read failed: ' + dbErr.message); return; }

  // only keep rows belonging to this user's decks
  const myDbuilds = (dbuilds ?? []).filter((db) => deckById.has(db.deck_id));
  console.log('deck_builds rows (this user):', myDbuilds.length, '(expected 4)');

  const starter = (decks ?? []).find((d) => d.name === 'Starter deck');
  const wip = (decks ?? []).find((d) => d.name === 'Work in progress');
  if (!starter) fail('missing deck "Starter deck"');
  if (!wip) fail('missing deck "Work in progress"');

  if (starter) {
    const rows = myDbuilds.filter((db) => db.deck_id === starter.id)
      .sort((a, b) => a.position - b.position);
    console.log('\n  "Starter deck":', rows.length, 'filled slots (expected 3)');
    if (rows.length !== 3) fail('Starter deck has ' + rows.length + ' builds, expected 3');
    for (const r of rows) {
      const b = byName.get(builds.find((x) => x.id === r.build_id)?.name ?? '');
      const bn = builds?.find((x) => x.id === r.build_id)?.name ?? '?';
      console.log('    slot', r.position, ':', bn);
    }
  }
  if (wip) {
    const rows = myDbuilds.filter((db) => db.deck_id === wip.id)
      .sort((a, b) => a.position - b.position);
    console.log('\n  "Work in progress":', rows.length, 'filled slots (expected 1)');
    if (rows.length !== 1) fail('WIP deck has ' + rows.length + ' builds, expected 1');
    if (rows.length === 1) {
      const bn = builds?.find((x) => x.id === rows[0].build_id)?.name ?? '?';
      const isDran = bn === 'Dran Sword';
      if (!isDran) fail('WIP deck contains "' + bn + '", expected "Dran Sword"');
      console.log('    slot', rows[0].position, ':', bn, isDran ? '(correct)' : '(WRONG)');
    }
  }

  console.log('\n=== RESULT ===');
  console.log(process.exitCode ? 'FAILED — see above' : 'ALL CHECKS PASSED');

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error('Uncaught error:', err);
  process.exit(1);
});
