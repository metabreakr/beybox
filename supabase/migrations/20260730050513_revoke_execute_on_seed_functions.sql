/*
# Lock down seed_parts and seed_products RPC endpoints

1. Security Changes
- Revoke EXECUTE on public.seed_parts(jsonb) and public.seed_products(jsonb)
  from PUBLIC, anon, and authenticated.
- service_role keeps EXECUTE on both (explicit grant preserved). The seed
  script (scripts/seed-catalogue.mjs) authenticates with the service role
  key, so it continues to work.
- Both functions remain SECURITY DEFINER — they must bypass RLS to write
  catalogue rows with owner_id = NULL. They are NOT switched to
  SECURITY INVOKER, which would run as the caller and fail to write
  catalogue rows at all.

2. Important Notes
- anon and authenticated are the only roles a browser can hold, so removing
  both closes the /rest/v1/rpc/seed_parts and /rest/v1/rpc/seed_products
  endpoints completely. A browser can no longer invoke either function.
- REVOKE ... FROM PUBLIC alone is insufficient on Supabase: EXECUTE is
  granted directly to anon and authenticated at function creation time, and
  those direct grants survive a PUBLIC revoke. All three are revoked here.
- is_superadmin() is intentionally NOT touched. Its authenticated EXECUTE
  grant is required because RLS policy expressions on profiles call it as
  the current user — revoking would break every SELECT on profiles for
  signed-in users. The authenticated grant is expected and documented.
*/

REVOKE EXECUTE ON FUNCTION public.seed_parts(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_parts(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_parts(jsonb) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.seed_products(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_products(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_products(jsonb) FROM authenticated;
