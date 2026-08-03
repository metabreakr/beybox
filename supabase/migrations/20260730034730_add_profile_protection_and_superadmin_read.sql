/*
# Add superadmin read access and profile role/plan protection

1. New Functions
- is_superadmin() — SECURITY DEFINER, returns boolean. Reads profiles
  bypassing RLS (owner has BYPASSRLS) to check whether the current
  auth.uid() has role = 'superadmin'. Used in RLS policies on profiles
  to avoid the infinite recursion that an inline subquery on profiles
  would cause.
- protect_profile_role_plan() — SECURITY DEFINER trigger function,
  fires BEFORE UPDATE on profiles. Compares OLD to NEW for role and
  plan, which a WITH CHECK policy cannot do (WITH CHECK sees only the
  new row; there is no OLD available to it). Three branches:
  (a) auth.uid() IS NULL → service_role / table owner → allow.
      This is the path Stripe uses to set plan = 'pro'. anon never
      reaches it because every UPDATE policy is TO authenticated, so
      RLS filters anon's statement to zero rows and the trigger
      never fires.
  (b) caller is superadmin → allow (can change anyone's role or plan).
  (c) regular user → reject if role or plan changed; display_name and
      email pass through untouched.

2. Security Changes
- superadmin_select_all_profiles: SELECT policy on profiles,
  TO authenticated, USING (is_superadmin()). Combined with the
  existing select_own_profile (auth.uid() = id), a regular user sees
  only their own row; a superadmin sees all rows. The admin users
  table in this build is read-only.
- select_own_profile and update_own_profile kept unchanged.
- No superadmin UPDATE or DELETE policy on profiles — least privilege.
  Role/plan changes are done in the Supabase table viewer (elevated
  rights, bypasses RLS) or by Stripe via service_role.
- EXECUTE revoked from PUBLIC on both new functions.
  - is_superadmin: granted to authenticated (RLS policies call it as
    the current user) and service_role. anon gets no EXECUTE, so
    /rest/v1/rpc/is_superadmin is closed to unauthenticated callers.
  - protect_profile_role_plan: granted to service_role only. The
    trigger calls it as the function owner (postgres), which always
    has EXECUTE — no authenticated grant needed.
- BEFORE UPDATE trigger on profiles fires protect_profile_role_plan.

3. Important Notes
- is_superadmin needs EXECUTE on authenticated because RLS policy
  expressions are evaluated as the current user, and PostgreSQL checks
  EXECUTE at call time. Revoking from PUBLIC without granting back to
  authenticated would break every SELECT on profiles for signed-in users.
- protect_profile_role_plan does not need EXECUTE on authenticated
  because it is only called by a trigger, which runs as the owner.
- The inline EXISTS (SELECT 1 FROM profiles ...) subqueries in the
  parts and products policies are unchanged — they read a different
  table, so they do not recurse.
- is_superadmin() is SECURITY DEFINER with SET search_path = public,
  matching the pattern used by handle_new_user. The owner (postgres)
  carries BYPASSRLS, so the internal SELECT on profiles never enters
  the profiles RLS policies — this is what avoids the recursion.
*/

-- ============================================================
-- 1. is_superadmin() helper function
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'superadmin'
  )
$$;

-- Close the RPC endpoint to unauthenticated callers, then re-grant
-- to the roles that need it: authenticated (RLS policy evaluation)
-- and service_role (elevated access).
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO service_role;

-- ============================================================
-- 2. protect_profile_role_plan() trigger function
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_profile_role_plan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  -- service_role / table owner: no JWT user, bypasses RLS.
  -- This is the path Stripe uses to set plan = 'pro'.
  IF actor IS NULL THEN
    RETURN NEW;
  END IF;

  -- superadmin: allow any change (role, plan, display_name, email).
  IF public.is_superadmin() THEN
    RETURN NEW;
  END IF;

  -- regular user: refuse changes to role and plan.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'You cannot change your own role.';
  END IF;
  IF NEW.plan IS DISTINCT FROM OLD.plan THEN
    RAISE EXCEPTION 'You cannot change your own plan.';
  END IF;

  RETURN NEW;
END;
$$;

-- Only called by the BEFORE UPDATE trigger, which runs as the owner.
-- service_role grant kept for explicitness; authenticated does not
-- need it (triggers execute as the function owner, not the caller).
REVOKE EXECUTE ON FUNCTION public.protect_profile_role_plan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_profile_role_plan() TO service_role;

-- ============================================================
-- 3. BEFORE UPDATE trigger on profiles
-- ============================================================

DROP TRIGGER IF EXISTS before_update_protect_profile ON profiles;
CREATE TRIGGER before_update_protect_profile
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_plan();

-- ============================================================
-- 4. Superadmin SELECT policy on profiles
-- ============================================================

DROP POLICY IF EXISTS "superadmin_select_all_profiles" ON profiles;
CREATE POLICY "superadmin_select_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (public.is_superadmin());
