
-- 1. Restrict SELECT on debenturistas to staff
DROP POLICY IF EXISTS "Authenticated view debenturistas" ON public.debenturistas;
CREATE POLICY "Staff view debenturistas" ON public.debenturistas
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

-- 2. Restrict SELECT on caixas to staff
DROP POLICY IF EXISTS "Authenticated view caixas" ON public.caixas;
CREATE POLICY "Staff view caixas" ON public.caixas
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

-- 3. Restrict SELECT on cedentes to staff
DROP POLICY IF EXISTS "Authenticated view cedentes" ON public.cedentes;
CREATE POLICY "Staff view cedentes" ON public.cedentes
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

-- 4. Restrict SELECT on sacados to staff
DROP POLICY IF EXISTS "Authenticated view sacados" ON public.sacados;
CREATE POLICY "Staff view sacados" ON public.sacados
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])));

-- 5. Remove self-assignment of operador role
DROP POLICY IF EXISTS "Users can create own operator role" ON public.user_roles;

-- 6. Lock down documentos-debenturistas storage bucket to staff
DROP POLICY IF EXISTS "Authenticated read documentos-debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated upload documentos-debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update documentos-debenturistas" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete documentos-debenturistas" ON storage.objects;

CREATE POLICY "Staff read documentos-debenturistas" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documentos-debenturistas' AND EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
));

CREATE POLICY "Staff upload documentos-debenturistas" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-debenturistas' AND EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
));

CREATE POLICY "Staff update documentos-debenturistas" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-debenturistas' AND EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
));

CREATE POLICY "Staff delete documentos-debenturistas" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'documentos-debenturistas' AND EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = auth.uid() AND role = ANY (ARRAY['admin'::app_role,'gestor'::app_role,'operador'::app_role])
));
