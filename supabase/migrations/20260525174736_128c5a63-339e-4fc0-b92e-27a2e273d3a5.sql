CREATE POLICY "Investidor view own debenturista"
ON public.debenturistas
FOR SELECT
TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));