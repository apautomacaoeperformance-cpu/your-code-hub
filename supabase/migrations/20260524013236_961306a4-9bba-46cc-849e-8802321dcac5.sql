
-- 1) Remove a política que permitia a qualquer usuário autenticado ler dados de debenturista
--    apenas por bater o e-mail do JWT (este é um app interno de equipe; investidores não logam).
DROP POLICY IF EXISTS "Investors view own debenturista" ON public.debenturistas;

-- 2) Restringir SELECT no bucket privado 'comprovantes-vendas' a equipe (admin/gestor/operador).
DROP POLICY IF EXISTS "Authenticated read comprovantes" ON storage.objects;

CREATE POLICY "Staff read comprovantes-vendas"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'comprovantes-vendas'
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = ANY (ARRAY['admin'::app_role, 'gestor'::app_role, 'operador'::app_role])
  )
);
