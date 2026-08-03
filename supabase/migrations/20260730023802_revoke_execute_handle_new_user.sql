/*
# Revoke EXECUTE on handle_new_user from anon and authenticated

1. Security Changes
- REVOKE EXECUTE on function handle_new_user() from the `anon`
  and `authenticated` roles.
- The function stays SECURITY DEFINER. It is only invoked by the
  `on_auth_user_created` trigger (which runs as the function owner),
  so it does not need EXECUTE on anon/authenticated to do its job.
- No INSERT policy is added to `profiles` — the function bypasses
  RLS as SECURITY DEFINER, which is the intended design.
- Nothing else in the schema changes.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
