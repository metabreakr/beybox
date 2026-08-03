---
name: wbo-deck-rules
description: >-
  Use whenever writing or changing deck validation, legality checks, part uniqueness, or anything that decides whether a deck is tournament-legal. Covers deck size, repeated parts, banned parts, completeness, and ratchet-integrated parts. ALWAYS consult before implementing or modifying any validation rule. Do not use for scoring or recommendations.
---

# WBO deck rules — BX/UX iteration

Simplified validator for the frozen build. Three-part Beyblades only. When CX
ships, revert to the full `wbo-rules.md`.

## The validator informs. It never blocks.

**Every rule here is advisory.** A deck can always be built, saved and used. The app reports its status; it doesn't police it.

**Why:** WBO rules govern *tournaments*. Casual play has no such constraints, and plenty of people build for fun, for testing, or against a friend who doesn't care. An app that refuses to let you assemble a combo you physically own is wrong about its own job.

**Also true within WBO play:** organisers can lift the Metal Needle ban or add their own restrictions via Ranked Clauses, so even "banned" isn't absolute.

**What this means in the UI:**
- A deck shows a status — *WBO legal*, or *Not WBO legal* with the specific reasons
- Save, load and edit work regardless
- Nothing is greyed out or unselectable
- The language is factual, not disapproving: "Contains Metal Needle, which is banned in WBO play" — not "Invalid deck"

## Deck construction
1. A deck is up to 3 Beys. Each Bey = Blade + Ratchet + Bit
2. No part repeats across the deck (a tournament rule, not a physical one — you may own two)
3. Each Bey should be complete — all three slots filled, **except** where a part has an integrated ratchet:
   - **Ratchet-integrated blade** — the ratchet is moulded into the blade
   - **Ratchet-integrated bit** — the ratchet is built into the bit (e.g. Turbo)

   In both cases the combo is complete with no ratchet, and supplying one is an error

## Part identity
- Two parts are the same when they share the same **`id`**. Catalogue ids are the canonical part — `IMPACTDRAKE`, `3-60`, `F`
- **Recolours and repackagings are already folded into one row.** A part appears once, whatever colourways it shipped in, so comparing `id` is all that is needed. There is no separate colour field to ignore
- Never compare `display_name` — two different parts can read alike, and an admin can edit it

## Bans
- Metal Needle (MN) is the only WBO-banned part in scope
- **It is NOT refused.** Flagged, never blocked — see below

## Not in this iteration
- CX Lock Chip repeat exception — no Lock Chips in BX/UX
- Metal Lock Chip rules
- CX Expand completeness

## Spin direction
- **The blade determines the combo's spin.** No ratchet or bit changes it
- Every ratchet and bit works with either direction; they behave differently,
  not incompatibly
- Spin is **not** a legality constraint. It's a coverage consideration — a deck
  spanning both directions has more matchup options
- Practical note for the UI: a left-spin bey needs a left-spin launcher. Not a
  deck rule, but worth surfacing

## Ownership vs legality — two different checks

| Check | Question | Blocks? |
|---|---|---|
| **Legality** | Would this deck be accepted at a WBO event? | No |
| **Buildability** | Do you own enough of these parts to physically assemble it? | No, but worth surfacing separately |

Owning two 3-60s doesn't make a repeat legal. Owning one doesn't stop you saving a deck that uses it twice — you just can't field it. Report both, block neither.

## Coverage (advisory, never blocks saving)
- Report which of Attack / Defense / Stamina / Balance the deck spans
- Report whether both spin directions appear
- Warn if all three combos share a type

## Scoring reference (display only)
Spin 1 · Over 2 · Burst 2 · Xtreme 3. Standard: 4 pts first stage, 7 final. Verify against worldbeyblade.org/rules/x.
