-- A SECURITY DEFINER function that upserts catalogue rows as the postgres
-- superuser, bypassing RLS so owner_id is stamped NULL (not auth.uid()).
-- Used by scripts/seed-catalogue.mjs to seed parts + products from JSON.
-- Idempotent: upsert on id. Returns only the affected row count — never row data.

CREATE OR REPLACE FUNCTION seed_parts(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO parts (
    id, owner_id, part_class, name, display_name, variant_name,
    short_name, canonical_id, type, spin, spin_origin, line,
    product_line, atk, def, sta, dsh, brs, hgt_stat, height_mm,
    weight_g, diameter_mm, gear, total_height_mm, exposed_height_mm,
    sides, is_metal_lock_chip, banned, simple_type, fixed_burst,
    ratchet_integrated, description, description_left, source, image,
    full_name, bit_note, ban_reason, search_terms, product_codes,
    source_ids, in_products, variants, modes, release_at
  )
  SELECT
    id, NULL, part_class, name, display_name, variant_name,
    short_name, canonical_id, type, spin, spin_origin, line,
    product_line, atk, def, sta, dsh, brs, hgt_stat, height_mm,
    weight_g, diameter_mm, gear, total_height_mm, exposed_height_mm,
    sides, is_metal_lock_chip, banned, simple_type, fixed_burst,
    ratchet_integrated, description, description_left, source, image,
    full_name, bit_note, ban_reason, search_terms, product_codes,
    source_ids, in_products, variants, modes, release_at
  FROM jsonb_populate_recordset(
    NULL::parts,
    payload
  )
  ON CONFLICT (id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    part_class = EXCLUDED.part_class,
    name = EXCLUDED.name,
    display_name = EXCLUDED.display_name,
    variant_name = EXCLUDED.variant_name,
    short_name = EXCLUDED.short_name,
    canonical_id = EXCLUDED.canonical_id,
    type = EXCLUDED.type,
    spin = EXCLUDED.spin,
    spin_origin = EXCLUDED.spin_origin,
    line = EXCLUDED.line,
    product_line = EXCLUDED.product_line,
    atk = EXCLUDED.atk,
    def = EXCLUDED.def,
    sta = EXCLUDED.sta,
    dsh = EXCLUDED.dsh,
    brs = EXCLUDED.brs,
    hgt_stat = EXCLUDED.hgt_stat,
    height_mm = EXCLUDED.height_mm,
    weight_g = EXCLUDED.weight_g,
    diameter_mm = EXCLUDED.diameter_mm,
    gear = EXCLUDED.gear,
    total_height_mm = EXCLUDED.total_height_mm,
    exposed_height_mm = EXCLUDED.exposed_height_mm,
    sides = EXCLUDED.sides,
    is_metal_lock_chip = EXCLUDED.is_metal_lock_chip,
    banned = EXCLUDED.banned,
    simple_type = EXCLUDED.simple_type,
    fixed_burst = EXCLUDED.fixed_burst,
    ratchet_integrated = EXCLUDED.ratchet_integrated,
    description = EXCLUDED.description,
    description_left = EXCLUDED.description_left,
    source = EXCLUDED.source,
    image = EXCLUDED.image,
    full_name = EXCLUDED.full_name,
    bit_note = EXCLUDED.bit_note,
    ban_reason = EXCLUDED.ban_reason,
    search_terms = EXCLUDED.search_terms,
    product_codes = EXCLUDED.product_codes,
    source_ids = EXCLUDED.source_ids,
    in_products = EXCLUDED.in_products,
    variants = EXCLUDED.variants,
    modes = EXCLUDED.modes,
    release_at = EXCLUDED.release_at;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

CREATE OR REPLACE FUNCTION seed_products(payload jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  INSERT INTO products (
    id, code, name, line, release_at,
    blade_id, ratchet_id, bit_id, cx_parts
  )
  SELECT
    id, code, name, line, release_at,
    blade_id, ratchet_id, bit_id, cx_parts
  FROM jsonb_populate_recordset(
    NULL::products,
    payload
  )
  ON CONFLICT (id) DO UPDATE SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    line = EXCLUDED.line,
    release_at = EXCLUDED.release_at,
    blade_id = EXCLUDED.blade_id,
    ratchet_id = EXCLUDED.ratchet_id,
    bit_id = EXCLUDED.bit_id,
    cx_parts = EXCLUDED.cx_parts;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- The seed runs unauthenticated (anon key, no session) by design: it bypasses
-- RLS via SECURITY DEFINER so owner_id is NULL, not auth.uid().
REVOKE EXECUTE ON FUNCTION seed_parts(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION seed_products(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION seed_parts(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION seed_products(jsonb) TO anon;
