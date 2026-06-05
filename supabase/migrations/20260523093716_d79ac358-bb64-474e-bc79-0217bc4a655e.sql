CREATE POLICY "Investors view own debenturista" ON public.debenturistas
FOR SELECT
TO authenticated
USING (
  email IS NOT NULL
  AND lower(email) = lower(auth.jwt() ->> 'email')
);