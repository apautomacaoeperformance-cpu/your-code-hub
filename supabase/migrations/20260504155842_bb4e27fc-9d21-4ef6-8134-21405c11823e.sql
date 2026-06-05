DROP POLICY IF EXISTS "Staff insert operacoes" ON public.operacoes;
DROP POLICY IF EXISTS "Staff update operacoes" ON public.operacoes;
DROP POLICY IF EXISTS "Managers delete operacoes" ON public.operacoes;

CREATE POLICY "Staff insert operacoes"
ON public.operacoes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Staff update operacoes"
ON public.operacoes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Managers delete operacoes"
ON public.operacoes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff insert cedentes" ON public.cedentes;
DROP POLICY IF EXISTS "Staff update cedentes" ON public.cedentes;
DROP POLICY IF EXISTS "Managers delete cedentes" ON public.cedentes;

CREATE POLICY "Staff insert cedentes"
ON public.cedentes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Staff update cedentes"
ON public.cedentes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Managers delete cedentes"
ON public.cedentes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role)
  )
);

DROP POLICY IF EXISTS "Staff insert sacados" ON public.sacados;
DROP POLICY IF EXISTS "Staff update sacados" ON public.sacados;
DROP POLICY IF EXISTS "Managers delete sacados" ON public.sacados;

CREATE POLICY "Staff insert sacados"
ON public.sacados
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Staff update sacados"
ON public.sacados
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role, 'operador'::app_role)
  )
);

CREATE POLICY "Managers delete sacados"
ON public.sacados
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin'::app_role, 'gestor'::app_role)
  )
);