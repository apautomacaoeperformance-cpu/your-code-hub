
-- 1. Storage: remove broad auth policies on documentos-debenturistas bucket
DROP POLICY IF EXISTS "Auth view docs debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Auth upload docs debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Auth update docs debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete docs debenturistas" ON storage.objects;

-- 2. Replace broad "Authenticated view *" SELECT policies on financial tables with staff-only
DROP POLICY IF EXISTS "Authenticated view rendimentos" ON public.rendimentos_debenture;
CREATE POLICY "Staff view rendimentos" ON public.rendimentos_debenture FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view informes" ON public.informes_rendimento;
CREATE POLICY "Staff view informes" ON public.informes_rendimento FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view retiradas" ON public.retiradas_debenture;
CREATE POLICY "Staff view retiradas" ON public.retiradas_debenture FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view operacoes" ON public.operacoes;
CREATE POLICY "Staff view operacoes" ON public.operacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view vendas" ON public.vendas_debenture;
CREATE POLICY "Staff view vendas" ON public.vendas_debenture FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view cotas" ON public.cotas_debenture;
CREATE POLICY "Staff view cotas" ON public.cotas_debenture FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view debentures" ON public.debentures;
CREATE POLICY "Staff view debentures" ON public.debentures FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view cdi_diario" ON public.cdi_diario;
CREATE POLICY "Staff view cdi_diario" ON public.cdi_diario FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

DROP POLICY IF EXISTS "Authenticated view feriados" ON public.feriados;
CREATE POLICY "Staff view feriados" ON public.feriados FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));
