/*
# Revoke EXECUTE from anon on is_superadmin and protect_profile_role_plan

1. Security Changes
- is_superadmin: anon had a direct EXECUTE grant (Supabase grants EXECUTE
  to anon+authenticated by default on function creation). The previous
  REVOKE FROM PUBLIC removed only the PUBLIC grant, leaving the direct
  anon grant in place. Revoke explicitly from anon now. authenticated
  keeps EXECUTE (RLS policy expressions call it as the current user),
  and service_role keeps EXECUTE.
- protect_profile_role_plan: revoke EXECUTE from anon and authenticated.
  Only the BEFORE UPDATE trigger calls it, which runs as the function
  owner (postgres, which always has EXECUTE). No client-facing role
  needs it. service_role grant kept for explicitness.

2. Important Notes
- REVOKE ... FROM PUBLIC is not sufficient on Supabase functions because
  EXECUTE is granted directly to anon and authenticated at creation time.
  Those direct grants survive a PUBLIC revoke. The handle_new_user
  migration fixed this the same way (revoke from anon + authenticated
  explicitly, then later from PUBLIC).
- After this migration the ACL for is_superadmin should be:
    postgres=X, authenticated=X, service_role=X  (no anon)
  and for protect_profile_role_plan:
    postgres=X, service_role=X  (no anon, no authenticated)
*/

REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role_plan() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_profile_role_plan() FROM authenticated;
