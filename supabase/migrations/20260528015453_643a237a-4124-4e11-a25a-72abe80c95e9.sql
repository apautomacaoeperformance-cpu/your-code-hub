-- Create app_parameters table
CREATE TABLE public.app_parameters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_parameters TO authenticated;
GRANT ALL ON public.app_parameters TO service_role;

-- Enable RLS
ALTER TABLE public.app_parameters ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Parameters are viewable by authenticated users" 
ON public.app_parameters 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Parameters can be updated by authenticated users" 
ON public.app_parameters 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Parameters can be managed by service_role" 
ON public.app_parameters 
USING (true)
WITH CHECK (true);

-- Insert default investment term texts
INSERT INTO public.app_parameters (key, value, description) VALUES
('termo_investimento_objeto', 'Este documento tem por objeto formalizar a adesão do INVESTIDOR acima qualificado às condições aplicáveis à subscrição de debêntures emitidas pela JHL SECURITIZADORA, nos termos da regulamentação aplicável e dos documentos de oferta.', 'Texto da seção Objeto do Termo de Investimento'),
('termo_investimento_declaracoes', 'O INVESTIDOR declara que: (i) recebeu, leu e compreendeu integralmente as características da operação, incluindo prazo, remuneração, riscos e condições de resgate; (ii) possui plena capacidade financeira para o investimento ora realizado; (iii) está ciente de que os investimentos em debêntures envolvem riscos, inclusive de crédito do emissor, e que rentabilidades passadas não representam garantia de resultados futuros; (iv) as informações cadastrais prestadas são verdadeiras, completas e atualizadas.', 'Texto da seção Declarações e Ciência'),
('termo_investimento_tributacao', 'Os rendimentos serão pagos conforme a periodicidade contratada e estarão sujeitos à retenção de Imposto de Renda na fonte, observadas as alíquotas regressivas aplicáveis à classe do ativo. Pagamentos serão efetuados em conta de titularidade do INVESTIDOR.', 'Texto da seção Tributação e Pagamentos'),
('termo_investimento_aceite', 'Ao assinar digitalmente este Termo, o INVESTIDOR manifesta de forma livre, expressa e inequívoca seu aceite às condições aqui descritas, nos termos da Medida Provisória nº 2.200-2/2001, sendo reconhecida a validade jurídica da assinatura eletrônica.', 'Texto da seção Aceite e Assinatura Digital');

-- Create trigger for updated_at
CREATE TRIGGER update_app_parameters_updated_at
BEFORE UPDATE ON public.app_parameters
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
