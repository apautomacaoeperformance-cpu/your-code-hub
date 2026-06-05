CREATE TABLE public.feriados (
  data date NOT NULL PRIMARY KEY,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'nacional',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view feriados" ON public.feriados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers insert feriados" ON public.feriados
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));

CREATE POLICY "Managers update feriados" ON public.feriados
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));

CREATE POLICY "Managers delete feriados" ON public.feriados
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));

CREATE TRIGGER feriados_updated_at
  BEFORE UPDATE ON public.feriados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();