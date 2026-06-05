CREATE TABLE public.retiradas_debenture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id uuid NOT NULL,
  debenture_id uuid NOT NULL,
  debenturista_id uuid NOT NULL,
  data_retirada date NOT NULL,
  tipo text NOT NULL DEFAULT 'rendimento',
  valor_retirado numeric NOT NULL DEFAULT 0,
  rendimento_bruto numeric NOT NULL DEFAULT 0,
  valor_ir_retido numeric NOT NULL DEFAULT 0,
  rendimento_liquido numeric NOT NULL DEFAULT 0,
  caixa_id uuid,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retiradas_debenture_venda ON public.retiradas_debenture(venda_id);
CREATE INDEX idx_retiradas_debenture_debenturista ON public.retiradas_debenture(debenturista_id);
CREATE INDEX idx_retiradas_debenture_data ON public.retiradas_debenture(data_retirada);

ALTER TABLE public.retiradas_debenture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view retiradas" ON public.retiradas_debenture
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert retiradas" ON public.retiradas_debenture
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','gestor','operador')));

CREATE POLICY "Staff update retiradas" ON public.retiradas_debenture
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','gestor','operador')));

CREATE POLICY "Managers delete retiradas" ON public.retiradas_debenture
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin','gestor')));

CREATE TRIGGER trg_retiradas_debenture_updated_at
  BEFORE UPDATE ON public.retiradas_debenture
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();