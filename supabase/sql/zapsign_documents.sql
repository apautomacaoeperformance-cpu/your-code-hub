-- ============================================================
-- ZapSign: tabela para rastrear documentos enviados para assinatura
-- Rode este SQL no Painel de Migração ou no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.zapsign_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  debenturista_id uuid REFERENCES public.debenturistas(id) ON DELETE CASCADE,
  document_token text NOT NULL UNIQUE,
  signer_token text,
  signer_email text,
  signer_name text,
  status text NOT NULL DEFAULT 'pending',
  signed_file_url text,
  original_file_url text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  signed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  raw_payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zapsign_documents_debenturista ON public.zapsign_documents(debenturista_id);
CREATE INDEX IF NOT EXISTS idx_zapsign_documents_status ON public.zapsign_documents(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapsign_documents TO authenticated;
GRANT ALL ON public.zapsign_documents TO service_role;

ALTER TABLE public.zapsign_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view zapsign_documents" ON public.zapsign_documents;
CREATE POLICY "Authenticated can view zapsign_documents"
  ON public.zapsign_documents FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated can insert zapsign_documents" ON public.zapsign_documents;
CREATE POLICY "Authenticated can insert zapsign_documents"
  ON public.zapsign_documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated can delete zapsign_documents" ON public.zapsign_documents;
CREATE POLICY "Authenticated can delete zapsign_documents"
  ON public.zapsign_documents FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_zapsign_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zapsign_documents_updated ON public.zapsign_documents;
CREATE TRIGGER trg_zapsign_documents_updated
  BEFORE UPDATE ON public.zapsign_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_zapsign_updated_at();
