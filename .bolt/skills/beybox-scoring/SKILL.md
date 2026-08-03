---
name: beybox-scoring
description: >-
  Use whenever building or changing the recommendation engine, scoring, ranking, or which of a user's own parts to suggest. Covers role weights, normalisation, tie-breaking, and how explanations are worded. ALWAYS consult before writing any code that ranks or recommends parts. Do not use for legality checks.
---

# Recommendation scoring — specification

How Beybox ranks combo completions and produces the "why" text.

## What this is, and what it is not

**"Weights" here is a scoring-algorithm term, not a Beyblade term.** It means the multiplier applied to each stat when computing a role score — not the physical mass of a part. Mass is `weight_g` and is a separate field.

**This is a stat-based suggestion engine, not a meta engine.** Real competitive strength comes from interactions the model doesn't capture: spin-direction matchups, how a ratchet's height suits a bit's contact behaviour, burst resistance against specific opposing archetypes, stadium and matchup context. A linear weighted sum is a deliberately crude approximation.

What it produces is **reasonable suggestions with clear explanations**, which is the right ambition for this build. Present it that way in the UI and in any write-up. Do not call it "the meta engine" — a Beyblade-literate reviewer would catch the overclaim immediately, and honest framing is stronger than a claim the maths doesn't support.

Genuine meta modelling — interaction effects, matchup tables, tournament-result weighting — is roadmap.

> **Calibration pending.** The weights below are a reasoned starting point, not tournament-validated. They assume stats on a roughly 0–150 scale. Once `parts.json` exists, normalise all stats to 0–1 before weighting—otherwise a stat with a wider natural range silently dominates. Tune against BBX Weekly rankings.

---

## 1. Inputs

- A selected Blade (plus CX sub-parts where applicable)
- A target role: Attack / Defense / Stamina / Balance
- The user's inventory
- The current deck, so already-consumed parts are excluded
- The meta table

## 2. Candidate generation

For every Ratchet R and Bit B:

- **Do not skip banned parts.** Score them, rank them, and label the result
  "banned in WBO play". Someone building for casual play should still see that
  Metal Needle is the best defensive bit they own
- Skip if R or B is already used elsewhere in the deck
- **Spin: there is no incompatibility to skip in BX/UX.** The blade determines
  the combo's spin direction, and no ratchet or bit changes it. Every part works
  in either direction — they just *behave* differently, which is why phstudy
  stores a separate left-spin description. In `parts.json` that field is **`description_left`**.

  So the rule is not exclusion, it's presentation: when the selected blade is
  left-spin, show each candidate part's left-spin description and say so in the
  explanation. (CX ratchets can be dual-spin, toggled by twisting the outer
  ring — out of scope for this build.)
- Skip if the blade is ratchet-integrated and R is present
- Mark `owned` = user has quantity ≥ 1 of both

**Generate candidates from the parts the user owns.** An earlier version generated the full set including unowned parts and filtered at display time, to make "next best" free — next best is not in this build, so unowned parts are never candidates.

## 3. Scoring

```
normalise(v, stat) = (v - min[stat]) / (max[stat] - min[stat])

roleScore = wAtk·n(atk) + wDef·n(def) + wSta·n(sta)
          + wDsh·n(dsh) + wBrs·n(brs)

score = 100 · (roleScore + heightFit)
```

### Role weights

| Role | wAtk | wDef | wSta | wDsh | wBrs |
|---|---|---|---|---|---|
| Attack | 0.45 | 0.05 | 0.05 | 0.30 | 0.15 |
| Defense | 0.10 | 0.45 | 0.20 | 0.05 | 0.20 |
| Stamina | 0.05 | 0.15 | 0.55 | 0.05 | 0.20 |
| Balance | 0.25 | 0.25 | 0.25 | 0.15 | 0.10 |

Each row sums to 1.0. Keep it that way when tuning—it makes scores comparable across roles.

### Height fit

Ratchet height materially changes behaviour. Bonus applied to `roleScore`:

| Role | Preferred height | Bonus | Outside band |
|---|---|---|---|
| Attack | 5.0–6.0 mm | +0.08 | −0.05 |
| Defense | 5.0–7.0 mm | +0.06 | −0.03 |
| Stamina | 7.0–9.0 mm | +0.08 | −0.05 |
| Balance | 6.0–8.0 mm | +0.04 | −0.02 |

### ~~Meta bonus~~ — NOT IN THIS BUILD

A `metaBonus` term was specified here. **It is out of scope and must not be implemented.** It needed a meta ranking per part, and those rankings were never sourced — `DATA-DICTIONARY.md` lists them under *what is NOT in here*, hand-entered from BBX Weekly. There is no data to compute it from.

**Never emit an explanation citing a meta rank**, and never invent one. Roadmap.

## 4. Explanations (D16)

Every recommendation carries 2–3 plain-language reasons. Generate them from whichever factors contributed most, in this order:

1. **Dominant stat** — "Highest stamina of your owned bits"
2. **Height** — "Same 6.0 mm height, no dash loss" / "Taller ratchet trades dash for stamina"
3. **Structural** — "9 contact points raise burst resistance"
5. **Spin** — "Left spin counters right-spin stamina builds"

Rules: never show more than three, never show a factor that contributed under 5% of the score, and never emit a bare number without a noun. "88" alone is not an explanation.

## 5. Next best (D15)

```
ownedRanked   = candidates.filter(owned).sort(desc)
allRanked     = candidates.sort(desc)
bestOwned     = ownedRanked[0]
nextBest      = allRanked.find(c => !c.owned && c.score > bestOwned.score)

delta = ((nextBest.score - bestOwned.score) / bestOwned.score) * 100
```

**NOT IN THIS BUILD.** Next-best suggests a part the user does *not* own, and its only action was adding to a wishlist, which this build does not have. **Score only from parts the user owns.** The formula is kept here for when it returns. Roadmap.

## 6. Deck-level guidance

Beyond per-combo scoring, report:

- **Type coverage** — which of the four archetypes the deck spans
- **Spin coverage** — whether both directions appear
- **Redundancy warning** — all three combos sharing a type

Advisory only. Never blocks saving. See wbo-rules.md §Implementation notes.

## 7. Edge cases

- **Empty inventory** — show unowned recommendations with a "you don't own any of these yet" empty state, not a blank panel
- **Single legal candidate** — say so rather than presenting a ranked list of one
- **Ties** — break by meta rank, then alphabetically. Never randomly; identical inputs must produce identical output
- **Missing stats** — a part with null stats scores as if the missing stat were the dataset median, and the explanation says the data is incomplete
