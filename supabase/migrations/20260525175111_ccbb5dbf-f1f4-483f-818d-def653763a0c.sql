
-- Helper: id do debenturista do usuário logado (por e-mail)
CREATE OR REPLACE FUNCTION public.current_debenturista_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.debenturistas
  WHERE lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND status = 'ativo'
  LIMIT 1;
$$;

-- vendas_debenture: investidor vê apenas as próprias
CREATE POLICY "Investidor view own vendas"
ON public.vendas_debenture
FOR SELECT
TO authenticated
USING (debenturista_id = public.current_debenturista_id());

-- retiradas_debenture: investidor vê apenas as próprias
CREATE POLICY "Investidor view own retiradas"
ON public.retiradas_debenture
FOR SELECT
TO authenticated
USING (debenturista_id = public.current_debenturista_id());

-- cotas_debenture: investidor vê apenas cotas vinculadas às suas vendas
CREATE POLICY "Investidor view own cotas"
ON public.cotas_debenture
FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.vendas_debenture v
  WHERE v.cota_id = cotas_debenture.id
    AND v.debenturista_id = public.current_debenturista_id()
));

-- debentures: investidor pode ler (necessário para join/cálculo)
CREATE POLICY "Investidor view debentures"
ON public.debentures
FOR SELECT
TO authenticated
USING (public.current_debenturista_id() IS NOT NULL);

-- cdi_diario: investidor pode ler (necessário para cálculo CDI)
CREATE POLICY "Investidor view cdi_diario"
ON public.cdi_diario
FOR SELECT
TO authenticated
USING (public.current_debenturista_id() IS NOT NULL);

-- feriados: investidor pode ler (necessário para dias úteis)
CREATE POLICY "Investidor view feriados"
ON public.feriados
FOR SELECT
TO authenticated
USING (public.current_debenturista_id() IS NOT NULL);
