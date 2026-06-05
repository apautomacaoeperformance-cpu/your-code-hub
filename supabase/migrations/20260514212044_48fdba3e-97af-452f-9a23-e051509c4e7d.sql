CREATE TABLE public.debentures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  taxa numeric NOT NULL DEFAULT 0,
  tipo_taxa text NOT NULL DEFAULT 'FIXA',
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debentures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view debentures" ON public.debentures
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert debentures" ON public.debentures
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role]))
  );

CREATE POLICY "Staff update debentures" ON public.debentures
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role]))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role]))
  );

CREATE POLICY "Managers delete debentures" ON public.debentures
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role]))
  );

CREATE TRIGGER debentures_updated_at BEFORE UPDATE ON public.debentures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER debentures_validate_status BEFORE INSERT OR UPDATE ON public.debentures
  FOR EACH ROW EXECUTE FUNCTION public.validate_cadastro_status();