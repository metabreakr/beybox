// Database row types — mirror the Beybox Supabase schema exactly.
// Keep these in sync with the migrations in supabase/migrations.

export type PartClass = 'blade' | 'ratchet' | 'bit';

export type Variant = {
  id: string;
  name: string;
  set_id: string | null;
  colour: string | null;
  release_at: string | null;
  is_mode: boolean;
  is_derived: boolean;
};

// A mode entry on a blade (e.g. SCORPIOSPEAR carries two).
// atk/def/sta override the part's base stats when the mode is active.
export type PartMode = {
  id: string;
  label: string;
  atk: number;
  def: number;
  sta: number;
};

export type ProductRef = {
  product_id: string;
  code: string | null;
  name: string;
  blade_id: string | null;
  ratchet_id: string | null;
  bit_id: string | null;
};

export type Part = {
  id: string;
  // null = catalogue row; set = that user's custom part
  owner_id: string | null;
  part_class: PartClass;
  // squashed uppercase identity — NOT for display
  name: string;
  // what the UI shows
  display_name: string;
  variant_name: string | null;
  short_name: string | null;
  canonical_id: string | null;
  type: string | null;
  spin: string | null;
  spin_origin: string | null;
  line: string | null;
  product_line: string | null;
  // Stats — nullable, no default. 0 is a real value; null = unknown.
  atk: number | null;
  def: number | null;
  sta: number | null;
  dsh: number | null;
  brs: number | null;
  hgt_stat: number | null;
  // The real assembly measurement in mm (NOT hgt_stat)
  height_mm: number | null;
  weight_g: number | null;
  diameter_mm: number | null;
  gear: number | null;
  total_height_mm: number | null;
  exposed_height_mm: number | null;
  sides: number | null;
  is_metal_lock_chip: boolean;
  banned: boolean;
  simple_type: boolean | null;
  fixed_burst: boolean | null;
  ratchet_integrated: boolean | null;
  description: string | null;
  description_left: string | null;
  source: string | null;
  image: string | null;
  // Bit-only text fields
  full_name: string | null;
  bit_note: string | null;
  ban_reason: string | null;
  // Native array columns
  search_terms: string[] | null;
  product_codes: string[] | null;
  source_ids: string[] | null;
  // jsonb columns
  in_products: ProductRef[] | null;
  variants: Variant[] | null;
  modes: PartMode[] | null;
  release_at: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  code: string | null;
  name: string | null;
  line: string | null;
  release_at: string | null;
  blade_id: string | null;
  ratchet_id: string | null;
  bit_id: string | null;
  cx_parts: unknown | null;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: 'user' | 'superadmin';
  plan: 'free' | 'pro';
  created_at: string;
};

export type Inventory = {
  user_id: string;
  part_id: string;
  quantity: number;
  created_at: string;
};

export type Build = {
  id: string;
  user_id: string;
  name: string;
  blade_id: string | null;
  ratchet_id: string | null;
  bit_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Deck = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type DeckBuild = {
  deck_id: string;
  build_id: string;
  position: number;
  created_at: string;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'superadmin';
  plan: 'free' | 'pro';
};
