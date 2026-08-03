/*
# Revoke EXECUTE on handle_new_user from PUBLIC

1. Security Changes
- REVOKE EXECUTE on function public.handle_new_user() from PUBLIC.
  The previous revokes on anon/authenticated individually were no-ops
  because EXECUTE was still granted to PUBLIC (the empty grantee in
  proacl), which both roles inherit.
- The function stays SECURITY DEFINER. Only the on_auth_user_created
  trigger fires it, running as the function owner — it does not need
  a PUBLIC grant.
- service_role's explicit grant is preserved.
- Nothing else in the schema changes.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
