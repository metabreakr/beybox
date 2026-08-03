/*
# Create Beybox core schema

1. New Tables
- `parts` — unified catalogue + custom-part table. Catalogue rows have
  owner_id = NULL and readable text ids (DRANSWORD, 3-60, F); custom rows
  have owner_id set to the creating user and a UUID id. All Beyblade parts
  (blades, ratchets, bits) live here, distinguished by part_class.
  Columns mirror parts.json exactly.
- `products` — BX/UX release catalogue (products.json). Each product
  references a blade, ratchet, and bit from parts.
- `inventory` — a row means the user owns that part; quantity tracks how
  many. Unique on (user_id, part_id).
- `builds` — a Bey (Blade + Ratchet + Bit assembly) created by a user.
- `decks` — a named group of up to 3 builds.
- `deck_builds` — join table placing a build into a deck slot (1-3).

2. Key column decisions
- display_name is what the UI shows; name is squashed uppercase, not for display.
- height_mm is the real assembly measurement in mm (decimal: 6.5, 8.5 exist),
  NOT hgt_stat (a 0-100 rating).
- search_terms, product_codes, source_ids are native text[] array columns.
- in_products, variants, modes are jsonb (typed binary, not stringified).
- modes is not always null — SCORPIOSPEAR carries two mode objects with their
  own atk/def/sta against different base stats. Seeded verbatim when data loads.
- atk, def, sta, dsh, brs, hgt_stat are nullable integers with NO default:
  0 is a real value, so a default of 0 would make unknown indistinguishable
  from a measured zero. Custom parts carry only the stats the user knows.

3. Foreign keys -> parts(id) are all ON DELETE RESTRICT
- products.blade_id, products.ratchet_id, products.bit_id
- builds.blade_id, builds.ratchet_id, builds.bit_id
- inventory.part_id
A part referenced by a product, build, or inventory row cannot be deleted;
the delete is refused and the app reports what blocks it.
- parts.owner_id -> profiles(id) is ON DELETE CASCADE (a deleted user's custom
  parts go with them; catalogue rows are untouched).

4. Security
- RLS enabled on all six new tables.
- parts: authenticated users read catalogue (owner_id IS NULL) + own custom
  rows. Write (insert/update/delete) allowed for own custom parts OR superadmin.
- products: authenticated users read all. Write only superadmin.
- inventory, builds, decks: owner-scoped CRUD (user_id = auth.uid()).
- deck_builds: scoped through parent deck (EXISTS on decks.user_id).
- profiles table is left unchanged in this migration.

5. Important Notes
- Catalogue read is authenticated only — nothing signed-out shows parts.
- owner_id defaults to auth.uid() so custom-part inserts that omit it still
  get stamped with the signed-in user.
- Superadmin check subquery reads profiles (a different table), so no RLS
  recursion on parts/products policies.
- profiles role/plan immutability and superadmin read-all deferred to a
  later step.
*/

-- ============================================================
-- 1. parts
-- ============================================================

CREATE TABLE IF NOT EXISTS parts (
  id text PRIMARY KEY,
  owner_id uuid DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  part_class text NOT NULL CHECK (part_class IN ('blade','ratchet','bit')),
  name text NOT NULL,
  display_name text NOT NULL,
  variant_name text,
  short_name text,
  canonical_id text,
  type text,
  spin text,
  spin_origin text,
  line text,
  product_line text,
  atk integer,
  def integer,
  sta integer,
  dsh integer,
  brs integer,
  hgt_stat integer,
  height_mm numeric(4,2),
  weight_g numeric,
  diameter_mm numeric,
  gear numeric,
  total_height_mm numeric,
  exposed_height_mm numeric,
  sides integer,
  is_metal_lock_chip boolean NOT NULL DEFAULT false,
  banned boolean NOT NULL DEFAULT false,
  simple_type boolean,
  fixed_burst boolean,
  ratchet_integrated boolean,
  description text,
  description_left text,
  source text,
  image text,
  full_name text,
  bit_note text,
  ban_reason text,
  search_terms text[],
  product_codes text[],
  source_ids text[],
  in_products jsonb,
  variants jsonb,
  modes jsonb,
  release_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS parts_catalogue_name_unique
  ON parts (part_class, name) WHERE owner_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS parts_custom_name_unique
  ON parts (owner_id, part_class, name) WHERE owner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS parts_part_class_idx ON parts (part_class);
CREATE INDEX IF NOT EXISTS parts_owner_id_idx ON parts (owner_id);
CREATE INDEX IF NOT EXISTS parts_banned_idx ON parts (banned);
CREATE INDEX IF NOT EXISTS parts_search_terms_gin ON parts USING GIN (search_terms);
CREATE INDEX IF NOT EXISTS parts_product_codes_gin ON parts USING GIN (product_codes);

ALTER TABLE parts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_parts" ON parts;
CREATE POLICY "select_parts" ON parts
  FOR SELECT TO authenticated
  USING (owner_id IS NULL OR owner_id = auth.uid());

DROP POLICY IF EXISTS "insert_parts" ON parts;
CREATE POLICY "insert_parts" ON parts
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "update_parts" ON parts;
CREATE POLICY "update_parts" ON parts
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "delete_parts" ON parts;
CREATE POLICY "delete_parts" ON parts
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ============================================================
-- 2. products
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  code text,
  name text,
  line text,
  release_at timestamptz,
  blade_id text REFERENCES parts(id) ON DELETE RESTRICT,
  ratchet_id text REFERENCES parts(id) ON DELETE RESTRICT,
  bit_id text REFERENCES parts(id) ON DELETE RESTRICT,
  cx_parts jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS products_code_unique
  ON products (code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_blade_id_idx ON products (blade_id);
CREATE INDEX IF NOT EXISTS products_ratchet_id_idx ON products (ratchet_id);
CREATE INDEX IF NOT EXISTS products_bit_id_idx ON products (bit_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'superadmin')
  );

-- ============================================================
-- 3. inventory
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  part_id text NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, part_id)
);

CREATE INDEX IF NOT EXISTS inventory_part_id_idx ON inventory (part_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_inventory" ON inventory;
CREATE POLICY "select_own_inventory" ON inventory
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_inventory" ON inventory;
CREATE POLICY "insert_own_inventory" ON inventory
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_inventory" ON inventory;
CREATE POLICY "update_own_inventory" ON inventory
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_inventory" ON inventory;
CREATE POLICY "delete_own_inventory" ON inventory
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 4. builds
-- ============================================================

CREATE TABLE IF NOT EXISTS builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  blade_id text REFERENCES parts(id) ON DELETE RESTRICT,
  ratchet_id text REFERENCES parts(id) ON DELETE RESTRICT,
  bit_id text REFERENCES parts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS builds_user_id_idx ON builds (user_id);

ALTER TABLE builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_builds" ON builds;
CREATE POLICY "select_own_builds" ON builds
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_builds" ON builds;
CREATE POLICY "insert_own_builds" ON builds
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_builds" ON builds;
CREATE POLICY "update_own_builds" ON builds
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_builds" ON builds;
CREATE POLICY "delete_own_builds" ON builds
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5. decks
-- ============================================================

CREATE TABLE IF NOT EXISTS decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decks_user_id_idx ON decks (user_id);

ALTER TABLE decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_decks" ON decks;
CREATE POLICY "select_own_decks" ON decks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_decks" ON decks;
CREATE POLICY "insert_own_decks" ON decks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_decks" ON decks;
CREATE POLICY "update_own_decks" ON decks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_decks" ON decks;
CREATE POLICY "delete_own_decks" ON decks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 6. deck_builds
-- ============================================================

CREATE TABLE IF NOT EXISTS deck_builds (
  deck_id uuid NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  build_id uuid NOT NULL REFERENCES builds(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deck_id, build_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS deck_builds_deck_position_unique
  ON deck_builds (deck_id, position);
CREATE INDEX IF NOT EXISTS deck_builds_build_id_idx ON deck_builds (build_id);

ALTER TABLE deck_builds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_deck_builds" ON deck_builds;
CREATE POLICY "select_deck_builds" ON deck_builds
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_builds.deck_id AND decks.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_deck_builds" ON deck_builds;
CREATE POLICY "insert_deck_builds" ON deck_builds
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_builds.deck_id AND decks.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_deck_builds" ON deck_builds;
CREATE POLICY "update_deck_builds" ON deck_builds
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_builds.deck_id AND decks.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_builds.deck_id AND decks.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_deck_builds" ON deck_builds;
CREATE POLICY "delete_deck_builds" ON deck_builds
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM decks WHERE decks.id = deck_builds.deck_id AND decks.user_id = auth.uid())
  );
