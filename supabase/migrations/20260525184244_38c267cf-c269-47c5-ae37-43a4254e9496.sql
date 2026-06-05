
ALTER TABLE public.debenturistas
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS debenturistas_auth_user_id_key
  ON public.debenturistas(auth_user_id) WHERE auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_debenturistas_auth_user_id ON public.debenturistas(auth_user_id);

-- Backfill: only one debenturista per auth user (pick most recent), and only confirmed emails
WITH ranked AS (
  SELECT d.id AS deb_id, u.id AS uid,
         row_number() OVER (PARTITION BY u.id ORDER BY d.created_at DESC) AS rn
  FROM public.debenturistas d
  JOIN auth.users u
    ON lower(u.email) = lower(d.email)
   AND u.email_confirmed_at IS NOT NULL
  WHERE d.auth_user_id IS NULL
)
UPDATE public.debenturistas d
SET auth_user_id = r.uid
FROM ranked r
WHERE d.id = r.deb_id AND r.rn = 1;

CREATE OR REPLACE FUNCTION public.current_debenturista_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.debenturistas
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

DROP POLICY IF EXISTS "Investidor view own debenturista" ON public.debenturistas;
CREATE POLICY "Investidor view own debenturista"
ON public.debenturistas
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS "Investidor view own rendimentos" ON public.rendimentos_debenture;
CREATE POLICY "Investidor view own rendimentos"
ON public.rendimentos_debenture
FOR SELECT
TO authenticated
USING (debenturista_id = public.current_debenturista_id());

DROP POLICY IF EXISTS "Investidor view own informes" ON public.informes_rendimento;
CREATE POLICY "Investidor view own informes"
ON public.informes_rendimento
FOR SELECT
TO authenticated
USING (debenturista_id = public.current_debenturista_id());
