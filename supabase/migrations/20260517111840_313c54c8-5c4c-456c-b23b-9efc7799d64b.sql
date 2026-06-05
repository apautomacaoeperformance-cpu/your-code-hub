CREATE OR REPLACE FUNCTION public.suspender_debentures_vencidas()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.debentures
  SET status = 'suspenso',
      updated_at = now()
  WHERE status = 'ativo'
    AND data_vencimento < CURRENT_DATE;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;