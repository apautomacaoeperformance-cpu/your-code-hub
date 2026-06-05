-- Campos do cadastro PF
ALTER TABLE public.debenturistas
  ADD COLUMN IF NOT EXISTS data_nascimento date,
  ADD COLUMN IF NOT EXISTS estado_civil text,
  ADD COLUMN IF NOT EXISTS rg text,
  ADD COLUMN IF NOT EXISTS orgao_emissor text,
  ADD COLUMN IF NOT EXISTS data_emissao_rg date,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS rua text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS empregador text,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS renda numeric,
  ADD COLUMN IF NOT EXISTS comprovante_cpf_path text,
  ADD COLUMN IF NOT EXISTS comprovante_rg_path text,
  ADD COLUMN IF NOT EXISTS comprovante_endereco_path text,
  ADD COLUMN IF NOT EXISTS comprovante_renda_path text,
  ADD COLUMN IF NOT EXISTS anexo_investidor_profissional_path text;

-- Bucket privado para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos-debenturistas', 'documentos-debenturistas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth view docs debenturistas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-debenturistas');

CREATE POLICY "Auth upload docs debenturistas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-debenturistas');

CREATE POLICY "Auth update docs debenturistas"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-debenturistas');

CREATE POLICY "Auth delete docs debenturistas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos-debenturistas');
