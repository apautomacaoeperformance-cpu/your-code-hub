
CREATE TABLE IF NOT EXISTS public.integrations_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration text NOT NULL,
  reference_id uuid,
  payload jsonb,
  response jsonb,
  status_code integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.integrations_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view integrations_log"
ON public.integrations_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_integrations_log_ref ON public.integrations_log(reference_id);
CREATE INDEX IF NOT EXISTS idx_integrations_log_created ON public.integrations_log(created_at DESC);
