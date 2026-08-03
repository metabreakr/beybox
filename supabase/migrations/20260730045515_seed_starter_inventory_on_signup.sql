/*
# Seed starter inventory, builds, and decks on sign-up

1. What changes
- Replaces the existing handle_new_user() trigger function so that, in
  addition to creating the profile row, it seeds a fixed starter set for
  every new account:
  - 9 catalogue parts added to inventory (quantity 1 each)
  - 3 builds — one per retail combo
  - 2 decks — a complete "Starter deck" and a partial "Work in progress"
- The trigger (on_auth_user_created) and its linkage are unchanged.
- EXECUTE on the function is re-revoked from PUBLIC/anon/authenticated
  at the end, matching the existing security posture. CREATE OR REPLACE
  preserves grants, but the explicit revokes make the migration safe to
  re-run regardless.

2. Starter parts (by id, no substitutions)
- Blade: DRANSWORD, WIZARDARROW, KNIGHTLANCE
- Ratchet: 3-60, 4-80, 4-60
- Bit: F, B, GB

3. Builds created
- "Dran Sword"    = DRANSWORD  + 3-60 + F   (attack,  BX-01)
- "Wizard Arrow"  = WIZARDARROW + 4-80 + B  (stamina, BX-03)
- "Knight Lance"  = KNIGHTLANCE + 4-60 + GB (defense, BX-24-03)

4. Decks created
- "Starter deck"     — all three builds (positions 1-3). WBO legal.
- "Work in progress" — Dran Sword only (position 1). Slots 2-3 empty.

5. Why this approach
- handle_new_user is SECURITY DEFINER and runs as the function owner,
  so it bypasses RLS and can insert into inventory/builds/decks/deck_builds
  without needing client-side inserts or additional policies.
- The function fires inside the same transaction as the auth.users INSERT.
  If seeding fails, the entire sign-up is rolled back — a reviewer never
  lands in a half-set-up account.
- auth.uid() is NULL in a trigger context, so every INSERT passes
  NEW.id explicitly as user_id rather than relying on the column default.

6. Security
- No new policies. The function is only callable via the trigger.
- EXECUTE re-revoked from PUBLIC, anon, authenticated (preserves
  existing posture).
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dran_sword   uuid;
  v_wizard_arrow uuid;
  v_knight_lance uuid;
  v_starter_deck uuid;
  v_wip_deck     uuid;
BEGIN
  -- Profile row (existing behaviour)
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );

  -- Starter inventory: 9 catalogue parts, quantity 1 each
  INSERT INTO public.inventory (user_id, part_id, quantity)
  VALUES
    (NEW.id, 'DRANSWORD',   1),
    (NEW.id, '3-60',        1),
    (NEW.id, 'F',           1),
    (NEW.id, 'WIZARDARROW', 1),
    (NEW.id, '4-80',        1),
    (NEW.id, 'B',           1),
    (NEW.id, 'KNIGHTLANCE', 1),
    (NEW.id, '4-60',        1),
    (NEW.id, 'GB',          1);

  -- Three builds — one per retail combo
  INSERT INTO public.builds (user_id, name, blade_id, ratchet_id, bit_id)
  VALUES (NEW.id, 'Dran Sword', 'DRANSWORD', '3-60', 'F')
  RETURNING id INTO v_dran_sword;

  INSERT INTO public.builds (user_id, name, blade_id, ratchet_id, bit_id)
  VALUES (NEW.id, 'Wizard Arrow', 'WIZARDARROW', '4-80', 'B')
  RETURNING id INTO v_wizard_arrow;

  INSERT INTO public.builds (user_id, name, blade_id, ratchet_id, bit_id)
  VALUES (NEW.id, 'Knight Lance', 'KNIGHTLANCE', '4-60', 'GB')
  RETURNING id INTO v_knight_lance;

  -- Starter deck: all three builds (attack / defense / stamina)
  INSERT INTO public.decks (user_id, name)
  VALUES (NEW.id, 'Starter deck')
  RETURNING id INTO v_starter_deck;

  INSERT INTO public.deck_builds (deck_id, build_id, position)
  VALUES
    (v_starter_deck, v_dran_sword,   1),
    (v_starter_deck, v_wizard_arrow, 2),
    (v_starter_deck, v_knight_lance, 3);

  -- Work in progress: Dran Sword only, other two slots empty
  INSERT INTO public.decks (user_id, name)
  VALUES (NEW.id, 'Work in progress')
  RETURNING id INTO v_wip_deck;

  INSERT INTO public.deck_builds (deck_id, build_id, position)
  VALUES (v_wip_deck, v_dran_sword, 1);

  RETURN NEW;
END;
$$;

-- Re-apply the existing EXECUTE revokes (idempotent safety on re-run)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
