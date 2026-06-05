-- 1. Fix app_parameters RLS
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Parameters can be managed by service_role" ON public.app_parameters;

-- Ensure RLS is enabled
ALTER TABLE public.app_parameters ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read parameters (viewable by all users)
CREATE POLICY "Parameters are viewable by everyone" 
ON public.app_parameters FOR SELECT 
USING (true);

-- Allow only admins to manage parameters
CREATE POLICY "Admins can manage parameters" 
ON public.app_parameters FOR ALL 
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Enhance Function Security
-- Revoke default public execution rights to prevent unauthorized access
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- Grant execution rights back to specific roles for specific functions
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_debenturista_id() TO authenticated, service_role;

-- The trigger function for new users only needs service_role access (used by Supabase Auth triggers)
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Ensure service_role maintains access to all functions for internal operations
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
