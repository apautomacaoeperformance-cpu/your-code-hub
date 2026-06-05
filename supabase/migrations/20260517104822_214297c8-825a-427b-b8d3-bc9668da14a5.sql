-- Tabela de snapshots mensais de rendimento por venda
CREATE TABLE public.rendimentos_debenture (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venda_id uuid NOT NULL,
  debenture_id uuid NOT NULL,
  debenturista_id uuid NOT NULL,
  data_competencia date NOT NULL,
  dias_uteis_periodo integer NOT NULL DEFAULT 0,
  rendimento_bruto numeric(18,2) NOT NULL DEFAULT 0,
  aliquota_ir numeric(5,2) NOT NULL DEFAULT 0,
  valor_ir_retido numeric(18,2) NOT NULL DEFAULT 0,
  rendimento_liquido numeric(18,2) NOT NULL DEFAULT 0,
  pago boolean NOT NULL DEFAULT false,
  data_pagamento date,
  observacoes text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (venda_id, data_competencia)
);

CREATE INDEX idx_rend_deb_venda ON public.rendimentos_debenture(venda_id);
CREATE INDEX idx_rend_deb_debenturista ON public.rendimentos_debenture(debenturista_id);
CREATE INDEX idx_rend_deb_debenture ON public.rendimentos_debenture(debenture_id);
CREATE INDEX idx_rend_deb_competencia ON public.rendimentos_debenture(data_competencia);

ALTER TABLE public.rendimentos_debenture ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view rendimentos"
  ON public.rendimentos_debenture FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert rendimentos"
  ON public.rendimentos_debenture FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
  ));

CREATE POLICY "Staff update rendimentos"
  ON public.rendimentos_debenture FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
  ));

CREATE POLICY "Managers delete rendimentos"
  ON public.rendimentos_debenture FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])
  ));

CREATE TRIGGER trg_rend_deb_updated
  BEFORE UPDATE ON public.rendimentos_debenture
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Tabela de informes anuais consolidados por debenturista
CREATE TABLE public.informes_rendimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debenturista_id uuid NOT NULL,
  debenture_id uuid,
  ano_calendario integer NOT NULL,
  total_rendimento_bruto numeric(18,2) NOT NULL DEFAULT 0,
  total_ir_retido numeric(18,2) NOT NULL DEFAULT 0,
  total_rendimento_liquido numeric(18,2) NOT NULL DEFAULT 0,
  saldo_em_31_12 numeric(18,2) NOT NULL DEFAULT 0,
  pdf_path text,
  gerado_em timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (debenturista_id, debenture_id, ano_calendario)
);

CREATE INDEX idx_informe_debenturista ON public.informes_rendimento(debenturista_id);
CREATE INDEX idx_informe_ano ON public.informes_rendimento(ano_calendario);

ALTER TABLE public.informes_rendimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view informes"
  ON public.informes_rendimento FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff insert informes"
  ON public.informes_rendimento FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
  ));

CREATE POLICY "Staff update informes"
  ON public.informes_rendimento FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
  ));

CREATE POLICY "Managers delete informes"
  ON public.informes_rendimento FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])
  ));

CREATE TRIGGER trg_informe_updated
  BEFORE UPDATE ON public.informes_rendimento
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();