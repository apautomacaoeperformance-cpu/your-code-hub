-- Criar trigger para gerar cotas automaticamente ao inserir debênture
DROP TRIGGER IF EXISTS trg_gerar_cotas_debenture ON public.debentures;
CREATE TRIGGER trg_gerar_cotas_debenture
AFTER INSERT ON public.debentures
FOR EACH ROW EXECUTE FUNCTION public.gerar_cotas_debenture();

-- Criar trigger para marcar cota como vendida ao registrar venda
DROP TRIGGER IF EXISTS trg_marcar_cota_vendida ON public.vendas_debenture;
CREATE TRIGGER trg_marcar_cota_vendida
AFTER INSERT ON public.vendas_debenture
FOR EACH ROW EXECUTE FUNCTION public.marcar_cota_vendida();

-- Backfill: gerar cotas faltantes para debêntures que já existem sem cotas
DO $$
DECLARE
  d RECORD;
  i integer;
  existentes integer;
BEGIN
  FOR d IN SELECT id, quantidade_cotas, created_by FROM public.debentures WHERE quantidade_cotas > 0 LOOP
    SELECT COUNT(*) INTO existentes FROM public.cotas_debenture WHERE debenture_id = d.id;
    IF existentes = 0 THEN
      FOR i IN 1..d.quantidade_cotas LOOP
        INSERT INTO public.cotas_debenture (debenture_id, numero, emitida_por)
        VALUES (d.id, lpad(i::text, 4, '0'), d.created_by);
      END LOOP;
    END IF;
  END LOOP;
END $$;