-- Update functions to use SECURITY INVOKER where possible
ALTER FUNCTION public.get_my_roles() SECURITY INVOKER;
ALTER FUNCTION public.current_debenturista_id() SECURITY INVOKER;

-- Re-verify permissions for has_role which remains SECURITY DEFINER
-- This is necessary to avoid circularity in RLS policies
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Re-verify handle_new_user permissions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
