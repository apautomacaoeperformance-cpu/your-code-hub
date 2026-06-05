
-- Caixas (financeiro)
CREATE TABLE public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view caixas" ON public.caixas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert caixas" ON public.caixas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Staff update caixas" ON public.caixas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Managers delete caixas" ON public.caixas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));
CREATE TRIGGER trg_caixas_updated_at BEFORE UPDATE ON public.caixas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Debenturistas (clientes que compram cotas) - PF/PJ
CREATE TABLE public.debenturistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'PF', -- PF | PJ
  nome text NOT NULL,
  documento text,
  email text,
  telefone text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.debenturistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view debenturistas" ON public.debenturistas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert debenturistas" ON public.debenturistas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Staff update debenturistas" ON public.debenturistas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Managers delete debenturistas" ON public.debenturistas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));
CREATE TRIGGER trg_debenturistas_updated_at BEFORE UPDATE ON public.debenturistas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cotas de debênture
CREATE TABLE public.cotas_debenture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debenture_id uuid NOT NULL REFERENCES public.debentures(id) ON DELETE CASCADE,
  numero text NOT NULL,
  situacao text NOT NULL DEFAULT 'disponivel', -- disponivel | vendida | cancelada
  emitida_em date NOT NULL DEFAULT CURRENT_DATE,
  emitida_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(debenture_id, numero)
);
CREATE INDEX idx_cotas_debenture_id ON public.cotas_debenture(debenture_id);
ALTER TABLE public.cotas_debenture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view cotas" ON public.cotas_debenture FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert cotas" ON public.cotas_debenture FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Staff update cotas" ON public.cotas_debenture FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Managers delete cotas" ON public.cotas_debenture FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));
CREATE TRIGGER trg_cotas_updated_at BEFORE UPDATE ON public.cotas_debenture FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Vendas de cotas
CREATE TABLE public.vendas_debenture (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debenture_id uuid NOT NULL REFERENCES public.debentures(id) ON DELETE CASCADE,
  cota_id uuid NOT NULL REFERENCES public.cotas_debenture(id) ON DELETE RESTRICT,
  debenturista_id uuid REFERENCES public.debenturistas(id) ON DELETE SET NULL,
  caixa_id uuid REFERENCES public.caixas(id) ON DELETE SET NULL,
  valor numeric NOT NULL DEFAULT 0,
  comprovante_path text,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vendas_debenture_id ON public.vendas_debenture(debenture_id);
CREATE INDEX idx_vendas_cota_id ON public.vendas_debenture(cota_id);
ALTER TABLE public.vendas_debenture ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view vendas" ON public.vendas_debenture FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert vendas" ON public.vendas_debenture FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Staff update vendas" ON public.vendas_debenture FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Managers delete vendas" ON public.vendas_debenture FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));
CREATE TRIGGER trg_vendas_updated_at BEFORE UPDATE ON public.vendas_debenture FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao criar debênture, gerar cotas automaticamente
CREATE OR REPLACE FUNCTION public.gerar_cotas_debenture()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE i integer;
BEGIN
  IF NEW.quantidade_cotas IS NOT NULL AND NEW.quantidade_cotas > 0 THEN
    FOR i IN 1..NEW.quantidade_cotas LOOP
      INSERT INTO public.cotas_debenture (debenture_id, numero, emitida_por)
      VALUES (NEW.id, lpad(i::text, 4, '0'), NEW.created_by);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_gerar_cotas AFTER INSERT ON public.debentures
FOR EACH ROW EXECUTE FUNCTION public.gerar_cotas_debenture();

-- Trigger: ao registrar venda, marcar cota como vendida
CREATE OR REPLACE FUNCTION public.marcar_cota_vendida()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.cotas_debenture SET situacao = 'vendida', updated_at = now()
  WHERE id = NEW.cota_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_marcar_cota_vendida AFTER INSERT ON public.vendas_debenture
FOR EACH ROW EXECUTE FUNCTION public.marcar_cota_vendida();

-- Storage bucket para comprovantes (privado)
INSERT INTO storage.buckets (id, name, public) VALUES ('comprovantes-vendas', 'comprovantes-vendas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read comprovantes" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'comprovantes-vendas');
CREATE POLICY "Staff upload comprovantes" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'comprovantes-vendas' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Staff update comprovantes" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'comprovantes-vendas' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
CREATE POLICY "Managers delete comprovantes" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'comprovantes-vendas' AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role])));
