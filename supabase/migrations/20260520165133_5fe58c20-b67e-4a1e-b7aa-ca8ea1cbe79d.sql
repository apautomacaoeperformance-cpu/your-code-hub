CREATE TABLE IF NOT EXISTS public.cdi_diario (
  data date PRIMARY KEY,
  taxa numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cdi_diario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view cdi_diario"
  ON public.cdi_diario FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Managers insert cdi_diario"
  ON public.cdi_diario FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role]))
  );

CREATE POLICY "Managers update cdi_diario"
  ON public.cdi_diario FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role]))
  );

CREATE TRIGGER set_updated_at_cdi_diario
  BEFORE UPDATE ON public.cdi_diario
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_cdi_diario_data ON public.cdi_diario(data DESC);