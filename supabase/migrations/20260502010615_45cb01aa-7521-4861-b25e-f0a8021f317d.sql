CREATE OR REPLACE FUNCTION public.marcar_inadimplentes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.operacoes
  SET status = 'inadimplente',
      updated_at = now()
  WHERE status = 'ativa'
    AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_inadimplentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_inadimplentes() TO authenticated;