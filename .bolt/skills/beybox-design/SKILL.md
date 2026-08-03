---
name: beybox-design
description: >-
  Use whenever writing or changing UI, styling, layout, components, or interface copy. Covers colour roles and what each means, typography, spacing, motion, mobile behaviour, the assembly stack, and copy conventions. ALWAYS consult before building or restyling any screen or component. Do not use for data or business logic.
---

# Beybox — design specification

Companion to `mockup-screens.html`, which is the authoritative visual reference. Where this document and the mockup disagree, the mockup wins.

---

## Thesis

**A technical parts catalogue, not a game UI.**

The obvious direction is anime energy—chrome, speed lines, explosive reds. That is the *marketing* of Beyblade X, not the *practice* of it. Competitive players think in millimetres, contact points, and spin direction. Beybox should feel like a well-made engineering component catalogue: precise, dense, legible, with photographed parts as the only ornament.

Deliberately avoided: cream + serif + terracotta, near-black with one neon accent, broadsheet hairline layouts. These are current AI-design defaults and read as tells.

## Naming

`Beybox` in prose. `BEYBOX` when locked up with the mark. Never `BeyBox`.

The official Beyblade X logo appears nowhere in the app. Beybox wears its own mark.

---

## Colour

**This build ships dark only.** Both palettes below are complete and both belong in the token layer — keep the light column defined so a theme can be added by flipping one attribute — but the root is `data-theme="dark"` and **there is no theme switcher in this build**. Light values are specified because they were measured for contrast, not because a user can reach them.

Two families with a strict separation: **brand colours are saturated and signal state; data colours are muted and signal information.** Brightness itself tells the user what is interactive.

### Brand — each has exactly one job

| Token | Dark | Light | Means |
|---|---|---|---|
| `--ok` | `#A2FF1F` | `#4E8C00` | Legal, saved, go. Primary button fill |
| `--warn` | `#FFB020` | `#9A6100` | Not legal, needs attention, in progress |
| `--info` | `#7BD6F5` | `#0E7490` | Informational — not owned, selection |
| `--accent` | `#FF3BB3` | `#B81478` | Strategic only. ~3 uses per screen |

Green fill uses `--ok-ink` `#12200A` for text in both themes.

Light-mode variants exist because the source colours are too light to pass contrast on white as text or hairline borders. Filled buttons keep the true brand colour with dark text.

### Data — muted, never competing

| Token | Dark | Light |
|---|---|---|
| `--atk` | `#FF6B3D` | `#C4441A` |
| `--def` | `#6E92D8` | `#3B62B8` |
| `--sta` | `#2A9D7F` | `#0E7A5C` |
| `--bal` | `#9179D9` | `#6B3FC4` |

### Surfaces

| Token | Dark | Light |
|---|---|---|
| `--page` | `#0D0F13` | `#EAEDF2` |
| `--s0` | `#14171C` | `#F2F4F7` |
| `--s1` | `#1C2027` | `#FFFFFF` |
| `--s2` | `#262B34` | `#E9ECF1` |
| `--line` | `#333A45` | `#D5DAE2` |
| `--line-h` | `#454E5C` | `#B9C0CC` |
| `--text` | `#E6E9EE` | `#14171C` |
| `--dim` | `#8B94A3` | `#5A6373` |
| `--faint` | `#5C6472` | `#8A93A2` |

`--s1h` and `--s2h` are the one-step hover lifts.

### Rules

- Border colour means **legality**. Background means **selection**. Never overload one channel with both
- Reserving a colour means giving up its other uses. DSH moved off yellow because a permanently-yellow bar reads as a false alarm
- Both themes are first-class. Every colour is specified twice

---

## Typography

| Role | Face | Usage |
|---|---|---|
| Wordmark | Michroma 400 | `BEYBOX` only |
| Display | IBM Plex Sans Condensed 700 | Headings, part names. Uppercase, tight tracking |
| Body | IBM Plex Sans 400/500 | Prose, descriptions |
| Data | IBM Plex Mono 500 | Every stat, ratchet designation, height, weight. Tabular figures |

Michroma is the accurate free match for the Eurostile-derived official wordmark. It ships one weight, which is why it is confined to the mark—Plex Condensed carries anything needing heft.

Ratchets are named like part numbers (`3-60`). Set them in mono and let that be true rather than decorative.

**Eyebrow labels:** Plex Condensed 700, 10px, `letter-spacing: .2em`, uppercase, `--faint`.

---

## The card — one component, five states

Explore, Inventory and Collection all use the same part card. Build it once; the state is a variant, not a new component.

| State | Means |
|---|---|
| `identity` | The blade that names a Bey |
| `picked` | Selected, for a bulk action or a slot |
| `active` | In use and legal |
| `marked` | Built but idle |
| `attn` | Banned, or not legal |

**Three stat bars, and which three depends on class** — blades and ratchets show ATK/DEF/STA, bits show ATK/DSH/STA. All five stats exist on every part; the card picks three.

Border colour carries the state. Background carries selection. The two never share a channel — a selected illegal card must read as both at once.

---

## Signature element

The combo builder renders Blade / Ratchet / Bit as a vertical exploded stack, **and the ratchet's real height in millimetres drives the vertical spacing.** Swapping a 3-60 for a 4-80 makes the stack visibly grow. Physical truth encoded in layout, with a mm ruler alongside.

⚠ **Height source (D67, D183):** use the ratchet's **`height_mm`** field — the pipeline already derived it from the name and it is a decimal (`3-60` is 6.0, `4-80` is 8.0, and 6.5 and 8.5 exist). **Never use `hgt_stat`**, which is a 0–100 rating that happens to equal `height_mm × 10` on ratchets — so a build reading the wrong one is ten times too large but *proportionally identical*, and every relative test passes on the bug.

This is where the boldness is spent. Everything else stays quiet. If something has to be cut, cut elsewhere.

---

## Motion

Restrained. Each case does a job.

| Effect | Detail |
|---|---|
| Ambient background | Cursor-following radial wash, brand colours at 4–9% alpha, under a dot grid masked to the pointer. Eased at 0.07 per frame so it drifts |
| Assembly stack | Height transitions on ratchet swap, ~240ms ease-out |
| Spin indicator | Slow continuous rotation matching the combo's actual spin direction |
| Hover | 150ms, one step only—surface lifts one level, border `--line` → `--line-h` |
| Conflict | Single amber pulse on all offending chips, then hold static |

Nothing ambient loops except the spin indicator. All motion disabled under `prefers-reduced-motion`.

Scattered micro-animation is a reliable tell of AI-generated UI. Restraint reads better than abundance.

---

## Mobile

**The mockup's own CSS is the mobile specification.** Its three breakpoints are the whole of it — take them exactly and **do not invent mobile layouts beyond them.** The screenshots are desktop captures, so they show you nothing about small widths; read the media queries.

**What the mockup actually specifies** — take these:

| Breakpoint | Change |
|---|---|
| `max-width:1080px` | Catalogue grid 4-up → **3-up**. Deck grid, screenshot stack, deck slots, account panels and columns all collapse to one. Account sidebar becomes a horizontal wrapped row |
| `max-width:760px` | Grid → **2-up**. Stat rows and deltas → 2-up. Nav scrolls horizontally. **Header becomes `position:static`.** Body padding 12px, hero and headline type steps down |
| `max-width:520px` | Grid → **1-up**. Search field takes a full row |

Stat rows stay horizontal bars at every size. Never radar charts.

**The header is sticky on desktop and not below 760px.** The mockup sets `position:static` there on purpose: a sticky header on a phone costs viewport it cannot spare.

**Do not build these** — they are outside this build's scope: a bottom-sheet part picker (the picker is the same inline picker at every size), a sticky bottom bar for deck slots or legality, or a separate mobile navigation pattern. Keep tap targets comfortable where it costs nothing.

---

## Copy

Plain and active, per Anthropic-style interface conventions and Jonathan's own house style.

- Sentence case for buttons, headings, labels
- No terminal punctuation on labels and headings. Helper text and empty-state body copy do take a period
- Verb-first actions: "Add to collection", not "Submit"
- An action keeps its name through the flow. "Save deck" produces "Deck saved"
- Empty states invite rather than apologise: an unfilled slot reads **"Choose a blade"**, not "No blade selected"
- Errors say what happened and what to do, without a first person: "3-60 is already in combo 02. Swap one out."
- Canadian spelling in user-facing copy—colour, catalogue, honours. Code identifiers stay US English (`color`, `borderColor`). **Data fields keep the names the JSON uses** — `snake_case`, e.g. `display_name`, `height_mm`, `hgt_stat`. Do not rewrite them into camelCase
- **English-forward (D81).** Part and product names display in English. Japanese may appear in brackets or within a description where it adds something, never as the primary label. The Japanese reading is not carried in `parts.json` at all — it exists only in the raw source, so there is nothing to display even if you wanted to
