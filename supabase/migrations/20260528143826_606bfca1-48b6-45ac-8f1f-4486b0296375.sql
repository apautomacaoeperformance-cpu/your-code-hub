
DROP POLICY IF EXISTS "Parameters are viewable by everyone" ON public.app_parameters;
DROP POLICY IF EXISTS "Parameters can be updated by authenticated users" ON public.app_parameters;
DROP POLICY IF EXISTS "Parameters are viewable by authenticated users" ON public.app_parameters;

CREATE POLICY "Authenticated users can view parameters"
ON public.app_parameters
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
