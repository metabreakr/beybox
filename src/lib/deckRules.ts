// WBO deck legality and coverage — BX/UX iteration.
// Every rule here is advisory. The validator informs; it never blocks.
// A deck can always be built, saved and used regardless of its status.

import type { Part } from '@/types/database';

// A Bey assembled from up to three parts. A ratchet-integrated blade has no ratchet.
export type AssembledBey = {
  buildId: string;
  name: string;
  blade: Part | null;
  ratchet: Part | null;
  bit: Part | null;
};

// A deck slot is either a Bey or empty. Decks are always modelled as 3 slots.
export type DeckSlot = AssembledBey | null;

export type Archetype = 'attack' | 'defense' | 'stamina' | 'balance';

const ARCHETYPES: Archetype[] = ['attack', 'defense', 'stamina', 'balance'];

function archetypeOf(type: string | null): Archetype | null {
  if (!type) return null;
  const t = type.toLowerCase();
  return (ARCHETYPES as string[]).includes(t) ? (t as Archetype) : null;
}

// A Bey is complete when it has a blade and a bit, and either a ratchet or an
// integrated blade. Supplying a ratchet to an integrated blade is itself an error.
export function isBeyComplete(bey: AssembledBey): boolean {
  if (!bey.blade || !bey.bit) return false;
  if (bey.blade.ratchet_integrated === true) return !bey.ratchet;
  return !!bey.ratchet;
}

export type LegalityIssue = {
  // factual, non-disapproving copy, e.g. "3-60 is in combo 01 and combo 02"
  message: string;
  severity: 'ban' | 'error' | 'incomplete';
};

export type Coverage = {
  types: Archetype[]; // which archetypes appear, in canonical order
  spins: string[]; // which spin directions appear, lowercased
  bothSpins: boolean; // true when the deck spans both right and left
  allSameType: boolean; // true when all three Beys share one archetype
};

export type DeckStatus = {
  legal: boolean; // true only when complete + no repeats + no bans
  issues: LegalityIssue[];
  coverage: Coverage;
  filledCount: number; // how many of the 3 slots hold a Bey
};

export function evaluateDeck(slots: DeckSlot[]): DeckStatus {
  const filled = slots.filter((s): s is AssembledBey => s != null);
  const filledCount = filled.length;

  const issues: LegalityIssue[] = [];

  // Completeness: each Bey must be complete.
  filled.forEach((bey, i) => {
    if (!isBeyComplete(bey)) {
      issues.push({
        severity: 'incomplete',
        message: `Combo ${String(i + 1).padStart(2, '0')} (${bey.name}) is incomplete.`,
      });
    }
  });

  if (filledCount < 3) {
    issues.push({
      severity: 'incomplete',
      message:
        filledCount === 0
          ? 'Deck is empty.'
          : `Deck has ${filledCount} of 3 combos filled.`,
    });
  }

  // No part id may repeat across the deck. Collect every part id used by each
  // filled Bey, then report any id appearing under more than one combo.
  const usage = new Map<string, number[]>(); // partId -> combo indices (1-based)
  filled.forEach((bey, i) => {
    const idx = i + 1;
    const ids = [
      bey.blade?.id,
      bey.ratchet?.id,
      bey.bit?.id,
    ].filter((id): id is string => !!id);
    for (const id of ids) {
      const list = usage.get(id) ?? [];
      if (!list.includes(idx)) list.push(idx);
      usage.set(id, list);
    }
  });

  for (const [id, indices] of usage) {
    if (indices.length > 1) {
      const part = filled
        .flatMap((b) => [b.blade, b.ratchet, b.bit])
        .find((p): p is Part => p?.id === id);
      const label = part?.display_name ?? id;
      const combos = indices.map((n) => `combo ${String(n).padStart(2, '0')}`).join(' and ');
      issues.push({
        severity: 'error',
        message: `${label} appears in ${combos}.`,
      });
    }
  }

  // Bans: Metal Needle (MN) is flagged, never blocked.
  for (const bey of filled) {
    const parts = [bey.blade, bey.ratchet, bey.bit].filter((p): p is Part => !!p);
    for (const p of parts) {
      if (p.banned) {
        issues.push({
          severity: 'ban',
          message: `${p.display_name} is banned in WBO play.`,
        });
      }
    }
  }

  const legal = issues.length === 0;

  // Coverage: read the blade's type directly; never compute it from stats.
  const types = new Set<Archetype>();
  const spins = new Set<string>();
  let typeForAllSame: Archetype | null = null;
  let allSameType = filledCount > 0;
  for (const bey of filled) {
    const a = archetypeOf(bey.blade?.type ?? null);
    if (a) {
      types.add(a);
      if (typeForAllSame == null) typeForAllSame = a;
      else if (typeForAllSame !== a) allSameType = false;
    } else {
      allSameType = false;
    }
    if (bey.blade?.spin) spins.add(bey.blade.spin.toLowerCase());
  }
  const bothSpins = spins.has('right') && spins.has('left');

  const coverage: Coverage = {
    types: ARCHETYPES.filter((a) => types.has(a)),
    spins: [...spins],
    bothSpins,
    allSameType: filledCount > 0 && allSameType,
  };

  return { legal: issues.length === 0, issues, coverage, filledCount };
}
