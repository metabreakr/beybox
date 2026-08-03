// Idempotent catalogue seed: reads parts.json + products.json from the project
// root and upserts them through the seed_parts / seed_products SECURITY DEFINER
// functions (created by migration create_seed_catalogue_function). Those
// functions run as the postgres superuser, bypassing RLS so owner_id is stamped
// NULL on every catalogue part — not auth.uid().
//
// Authenticates with the service role key: EXECUTE on seed_parts/seed_products
// is restricted to service_role (anon/authenticated/PUBLIC revoked), so the
// REST endpoints are closed to browsers. The SECURITY DEFINER functions still
// bypass RLS to write catalogue rows with owner_id = NULL.
//
// The JSON file contents are read at runtime and sent over HTTP — they are
// never printed, logged, or transcribed. Re-runnable: upsert on id.
//
// Usage:  node scripts/seed-catalogue.mjs
// Prints counts and errors only.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function loadEnv(path) {
  const txt = await readFile(path, "utf8");
  const env = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = await loadEnv(join(ROOT, ".env"));
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const PART_BATCH = 25; // ~2.4KB per row → ~60KB per request, well under limits
const PRODUCT_BATCH = 100;

async function rpc(fnName, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ payload }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${fnName} batch failed (${res.status}): ${text}`);
  }
  return Number(text);
}

async function seedChunked(fnName, rows, batchSize, label) {
  let total = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    const n = await rpc(fnName, slice);
    total += n;
    process.stdout.write(".");
  }
  process.stdout.write(` ${label}: ${total} rows upserted\n`);
  return total;
}

// --- parts.json: { blade: [...], ratchet: [...], bit: [...] } ---
const partsRaw = JSON.parse(await readFile(join(ROOT, "parts.json"), "utf8"));
const parts = [
  ...(partsRaw.blade ?? []),
  ...(partsRaw.ratchet ?? []),
  ...(partsRaw.bit ?? []),
].map((p) => ({ ...p, owner_id: null })); // explicit null; function also forces NULL

console.log(`Parts read: ${parts.length}`);
const partCount = await seedChunked("seed_parts", parts, PART_BATCH, "parts");

// --- products.json: flat array ---
const products = JSON.parse(await readFile(join(ROOT, "products.json"), "utf8"));
console.log(`Products read: ${products.length}`);
const productCount = await seedChunked("seed_products", products, PRODUCT_BATCH, "products");

console.log(`\nSeed complete: ${partCount} parts, ${productCount} products.`);
