-- 1. Coluna consolidado e tipo_calculo em rendimentos_debenture
ALTER TABLE public.rendimentos_debenture
  ADD COLUMN IF NOT EXISTS consolidado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_calculo text NOT NULL DEFAULT 'FIXA';

CREATE INDEX IF NOT EXISTS idx_rendimentos_consolidado
  ON public.rendimentos_debenture(consolidado);

-- 2. Trigger: impede UPDATE/DELETE em registros consolidados
CREATE OR REPLACE FUNCTION public.proteger_rendimento_consolidado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.consolidado THEN
      RAISE EXCEPTION 'Rendimento consolidado não pode ser excluído (id=%)', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.consolidado THEN
    -- Permite apenas marcar pago / data_pagamento / observações
    IF NEW.rendimento_bruto IS DISTINCT FROM OLD.rendimento_bruto
       OR NEW.valor_ir_retido IS DISTINCT FROM OLD.valor_ir_retido
       OR NEW.rendimento_liquido IS DISTINCT FROM OLD.rendimento_liquido
       OR NEW.aliquota_ir IS DISTINCT FROM OLD.aliquota_ir
       OR NEW.dias_uteis_periodo IS DISTINCT FROM OLD.dias_uteis_periodo
       OR NEW.data_competencia IS DISTINCT FROM OLD.data_competencia
       OR NEW.consolidado IS DISTINCT FROM OLD.consolidado
       OR NEW.tipo_calculo IS DISTINCT FROM OLD.tipo_calculo THEN
      RAISE EXCEPTION 'Rendimento consolidado é imutável (id=%). Apenas data_pagamento, pago e observacoes podem ser alterados.', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_rendimento_upd ON public.rendimentos_debenture;
CREATE TRIGGER trg_proteger_rendimento_upd
BEFORE UPDATE ON public.rendimentos_debenture
FOR EACH ROW EXECUTE FUNCTION public.proteger_rendimento_consolidado();

DROP TRIGGER IF EXISTS trg_proteger_rendimento_del ON public.rendimentos_debenture;
CREATE TRIGGER trg_proteger_rendimento_del
BEFORE DELETE ON public.rendimentos_debenture
FOR EACH ROW EXECUTE FUNCTION public.proteger_rendimento_consolidado();

-- 3. Tabela cdi_auditoria
CREATE TABLE IF NOT EXISTS public.cdi_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  taxa_anterior numeric NOT NULL,
  taxa_nova numeric NOT NULL,
  alterado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cdi_auditoria_data ON public.cdi_auditoria(data);

ALTER TABLE public.cdi_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view cdi_auditoria" ON public.cdi_auditoria;
CREATE POLICY "Admins view cdi_auditoria"
ON public.cdi_auditoria FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Trigger em cdi_diario para auditar alterações
CREATE OR REPLACE FUNCTION public.auditar_cdi_diario()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.taxa IS DISTINCT FROM OLD.taxa THEN
    INSERT INTO public.cdi_auditoria (data, taxa_anterior, taxa_nova)
    VALUES (OLD.data, OLD.taxa, NEW.taxa);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_cdi_diario ON public.cdi_diario;
CREATE TRIGGER trg_auditar_cdi_diario
AFTER UPDATE ON public.cdi_diario
FOR EACH ROW EXECUTE FUNCTION public.auditar_cdi_diario();