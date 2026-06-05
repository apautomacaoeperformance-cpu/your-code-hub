-- Insert/Update the new Termo de Investidor Qualificado template
INSERT INTO public.app_parameters (key, value, description) VALUES
(
  'termo_investidor_qualificado',
  E'JHL SECURITIZADORA S/A, pessoa jurídica de direito privado, inscrita no CNPJ sob o n. 66.352.239/0001-39, sediada à RUA DOM AQUINO, NÚMERO 2350, BAIRRO CENTRO, COMPLEMENTO LOJA 1 A 09 E 12 A 19 EDIF ATRIUM ; SHOPPING BUSINESS, CIDADE CAMPO GRANDE/MS CEP: 79002-183.\n\n[SECTION]DECLARAÇÃO DE INVESTIDOR QUALIFICADO[/SECTION]\n\nPelo presente termo, a JHL SECURITIZADORA S/A declara que o(a) investidor(a) {{nome}}, inscrito(a) no CPF sob o nº {{cpf}}, residente e domiciliado(a) em {{endereco}}, declara, para os devidos fins e sob as penas da lei, que se enquadra como Investidor Qualificado, nos termos da regulamentação vigente estabelecida pela Comissão de Valores Mobiliários – CVM.\n\nA JHL SECURITIZADORA S/A declara ainda que:\n\nDeclaramos que todos os investimentos que realizo junto à JHL SECURITIZADORA S/A são efetuados na condição de Investidor Qualificado, independentemente do valor aportado.\n\nO investidor declara possuir pleno conhecimento dos riscos associados a este tipo de investimento, incluindo risco de crédito, risco de mercado, risco de liquidez e demais riscos inerentes ao produto financeiro adquirido.\n\nO investidor confirma possuir conhecimento técnico e experiência necessários para compreender a natureza e os riscos do investimento.\n\nO investidor está ciente de que este documento é indispensável para a formalização da operação e declaração da minha condição de investidor qualificado.\n\nCampo Grande, MS, {{data}}.',
  'Texto completo do Termo de Investidor Qualificado. Placeholders disponíveis: {{nome}}, {{cpf}}, {{endereco}}, {{data}}. Use [SECTION]Título[/SECTION] para criar subtítulos.'
)
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
