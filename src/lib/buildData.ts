// Shared loaders and types for builds and decks.
// Reads from the existing builds, decks, and deck_builds tables.

import { supabase } from '@/lib/supabaseClient';
import type { Part, Build, Deck, DeckBuild } from '@/types/database';
import type { AssembledBey, DeckSlot } from '@/lib/deckRules';

export type BuildWithParts = AssembledBey & {
  // created_at/updated_at for sorting
  created_at: string;
  updated_at: string;
};

export type DeckWithBuilds = Deck & {
  // Always length 3, ordered by position 1..3. null for empty slots.
  slots: (BuildWithParts | null)[];
};

const SLOT_COUNT = 3;

// Fetch the signed-in user's builds, with blade/ratchet/bit parts resolved.
export async function loadBuilds(userId: string): Promise<BuildWithParts[]> {
  const { data: builds, error: bErr } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (bErr) throw bErr;
  if (!builds || builds.length === 0) return [];

  const partIds = new Set<string>();
  for (const b of builds as Build[]) {
    if (b.blade_id) partIds.add(b.blade_id);
    if (b.ratchet_id) partIds.add(b.ratchet_id);
    if (b.bit_id) partIds.add(b.bit_id);
  }

  const partsById = new Map<string, Part>();
  if (partIds.size > 0) {
    const ids = [...partIds];
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data: parts, error: pErr } = await supabase
        .from('parts')
        .select('*')
        .in('id', slice);
      if (pErr) throw pErr;
      for (const p of (parts as Part[] | null) ?? []) partsById.set(p.id, p);
    }
  }

  return (builds as Build[]).map((b) => {
    const blade = b.blade_id ? (partsById.get(b.blade_id) ?? null) : null;
    const ratchet = b.ratchet_id ? (partsById.get(b.ratchet_id) ?? null) : null;
    const bit = b.bit_id ? (partsById.get(b.bit_id) ?? null) : null;
    return {
      buildId: b.id,
      name: b.name,
      blade,
      ratchet,
      bit,
      created_at: b.created_at,
      updated_at: b.updated_at,
    };
  });
}

// Fetch a single build by id with its parts resolved.
export async function loadBuild(
  buildId: string,
): Promise<BuildWithParts | null> {
  const { data: build, error: bErr } = await supabase
    .from('builds')
    .select('*')
    .eq('id', buildId)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!build) return null;
  const b = build as Build;

  const partIds = [b.blade_id, b.ratchet_id, b.bit_id].filter(
    (id): id is string => !!id,
  );
  const partsById = new Map<string, Part>();
  if (partIds.length > 0) {
    const { data: parts, error: pErr } = await supabase
      .from('parts')
      .select('*')
      .in('id', partIds);
    if (pErr) throw pErr;
    for (const p of (parts as Part[] | null) ?? []) partsById.set(p.id, p);
  }

  return {
    buildId: b.id,
    name: b.name,
    blade: b.blade_id ? (partsById.get(b.blade_id) ?? null) : null,
    ratchet: b.ratchet_id ? (partsById.get(b.ratchet_id) ?? null) : null,
    bit: b.bit_id ? (partsById.get(b.bit_id) ?? null) : null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
}

// Fetch the signed-in user's decks, each with its 3 slots populated.
export async function loadDecks(
  userId: string,
  builds: BuildWithParts[],
): Promise<DeckWithBuilds[]> {
  const { data: decks, error: dErr } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (dErr) throw dErr;
  if (!decks || decks.length === 0) return [];

  const deckIds = (decks as Deck[]).map((d) => d.id);
  const { data: deckBuilds, error: dbErr } = await supabase
    .from('deck_builds')
    .select('*')
    .in('deck_id', deckIds)
    .order('position', { ascending: true });
  if (dbErr) throw dbErr;

  const buildsById = new Map(builds.map((b) => [b.buildId, b]));
  const slotsByDeck = new Map<string, (BuildWithParts | null)[]>();

  // If a build referenced by a deck_build wasn't in the user's build list
  // (e.g. it was deleted), fetch it individually so the slot still resolves.
  const missingBuildIds = new Set<string>();
  for (const db of (deckBuilds as DeckBuild[] | null) ?? []) {
    if (!buildsById.has(db.build_id)) missingBuildIds.add(db.build_id);
  }
  for (const id of [...missingBuildIds]) {
    const b = await loadBuild(id);
    if (b) buildsById.set(id, b);
  }

  for (const d of decks as Deck[]) {
    const empty: (BuildWithParts | null)[] = [null, null, null];
    slotsByDeck.set(d.id, empty);
  }
  for (const db of (deckBuilds as DeckBuild[] | null) ?? []) {
    const slots = slotsByDeck.get(db.deck_id);
    if (slots && db.position >= 1 && db.position <= SLOT_COUNT) {
      slots[db.position - 1] = buildsById.get(db.build_id) ?? null;
    }
  }

  return (decks as Deck[]).map((d) => ({
    ...d,
    slots: slotsByDeck.get(d.id) ?? [null, null, null],
  }));
}

// Insert a new deck and return it.
export async function createDeck(
  userId: string,
  name: string,
): Promise<Deck> {
  const { data, error } = await supabase
    .from('decks')
    .insert({ user_id: userId, name })
    .select('*')
    .single();
  if (error) throw error;
  return data as Deck;
}

// Duplicate a deck: create a new deck with the same builds in the same slots.
// Builds themselves are not copied — the new deck references the same builds.
export async function duplicateDeck(
  userId: string,
  source: DeckWithBuilds,
): Promise<Deck> {
  const created = await createDeck(userId, `${source.name} copy`);
  const rows = source.slots
    .map((b, i) =>
      b ? { deck_id: created.id, build_id: b.buildId, position: i + 1 } : null,
    )
    .filter((r): r is NonNullable<typeof r> => r != null);
  if (rows.length > 0) {
    const { error } = await supabase.from('deck_builds').insert(rows);
    if (error) throw error;
  }
  return created;
}

// Place a build into a deck position, replacing whatever was there.
export async function setDeckSlot(
  deckId: string,
  buildId: string,
  position: number,
): Promise<void> {
  // Delete the existing row at that position (if any), then insert.
  const { error: delErr } = await supabase
    .from('deck_builds')
    .delete()
    .eq('deck_id', deckId)
    .eq('position', position);
  if (delErr) throw delErr;
  const { error: insErr } = await supabase
    .from('deck_builds')
    .insert({ deck_id: deckId, build_id: buildId, position });
  if (insErr) throw insErr;
}

// Remove whatever build occupies a deck position.
export async function clearDeckSlot(
  deckId: string,
  position: number,
): Promise<void> {
  const { error } = await supabase
    .from('deck_builds')
    .delete()
    .eq('deck_id', deckId)
    .eq('position', position);
  if (error) throw error;
}

// Remove a build from every deck it appears in.
export async function removeBuildFromAllDecks(buildId: string): Promise<void> {
  const { error } = await supabase
    .from('deck_builds')
    .delete()
    .eq('build_id', buildId);
  if (error) throw error;
}

// Render any thrown value as a plain string. Supabase errors are objects, so
// `String(err)` would yield "[object Object]"; this reads `.message` first.
export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

// Combined stats for a Bey, mirroring the Builder's computation.
export function combinedStats(bey: AssembledBey): {
  atk: number;
  def: number;
  sta: number;
  dsh: number;
  weight: number;
  spin: string | null;
  height: number | null;
} {
  const ratchetNa = bey.blade?.ratchet_integrated === true;
  const parts = [bey.blade, ratchetNa ? null : bey.ratchet, bey.bit].filter(
    (p): p is Part => p != null,
  );
  const sum = (key: 'atk' | 'def' | 'sta' | 'dsh') =>
    parts.reduce((acc, p) => acc + (p[key] ?? 0), 0);
  const weight = parts.reduce((acc, p) => acc + (p.weight_g ?? 0), 0);
  return {
    atk: sum('atk'),
    def: sum('def'),
    sta: sum('sta'),
    dsh: sum('dsh'),
    weight,
    spin: bey.blade?.spin ?? null,
    height: ratchetNa ? null : bey.ratchet?.height_mm ?? null,
  };
}
