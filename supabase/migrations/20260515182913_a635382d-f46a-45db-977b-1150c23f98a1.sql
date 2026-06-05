ALTER TABLE public.debenturistas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

CREATE OR REPLACE FUNCTION public.validate_debenturista_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('ativo','suspenso','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_debenturista_status ON public.debenturistas;
CREATE TRIGGER trg_validate_debenturista_status
BEFORE INSERT OR UPDATE ON public.debenturistas
FOR EACH ROW EXECUTE FUNCTION public.validate_debenturista_status();