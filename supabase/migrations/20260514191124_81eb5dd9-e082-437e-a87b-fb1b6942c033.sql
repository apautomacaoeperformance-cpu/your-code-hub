ALTER TABLE public.cedentes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';
ALTER TABLE public.sacados ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

CREATE OR REPLACE FUNCTION public.validate_cadastro_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('ativo','suspenso','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_cedentes_status ON public.cedentes;
CREATE TRIGGER validate_cedentes_status BEFORE INSERT OR UPDATE ON public.cedentes
FOR EACH ROW EXECUTE FUNCTION public.validate_cadastro_status();

DROP TRIGGER IF EXISTS validate_sacados_status ON public.sacados;
CREATE TRIGGER validate_sacados_status BEFORE INSERT OR UPDATE ON public.sacados
FOR EACH ROW EXECUTE FUNCTION public.validate_cadastro_status();

UPDATE public.cedentes SET status = CASE WHEN ativo THEN 'ativo' ELSE 'cancelado' END;
UPDATE public.sacados SET status = CASE WHEN ativo THEN 'ativo' ELSE 'cancelado' END;