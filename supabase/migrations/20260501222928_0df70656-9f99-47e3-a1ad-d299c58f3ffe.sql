-- Enum de papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'operador', 'investidor');

-- Enum de status de operação
CREATE TYPE public.operacao_status AS ENUM ('rascunho', 'ativa', 'liquidada', 'inadimplente', 'cancelada');

-- Tipo de pessoa
CREATE TYPE public.pessoa_tipo AS ENUM ('PF', 'PJ');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function (evita recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para criar profile e role padrão no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'operador');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger updated_at genérico
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE PLPGSQL AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Cedentes
CREATE TABLE public.cedentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL UNIQUE,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cedentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view cedentes" ON public.cedentes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert cedentes" ON public.cedentes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Staff update cedentes" ON public.cedentes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Managers delete cedentes" ON public.cedentes FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE TRIGGER cedentes_updated_at BEFORE UPDATE ON public.cedentes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Sacados
CREATE TABLE public.sacados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo pessoa_tipo NOT NULL DEFAULT 'PJ',
  nome TEXT NOT NULL,
  documento TEXT NOT NULL UNIQUE,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sacados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view sacados" ON public.sacados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert sacados" ON public.sacados FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Staff update sacados" ON public.sacados FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Managers delete sacados" ON public.sacados FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE TRIGGER sacados_updated_at BEFORE UPDATE ON public.sacados FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Operações / CCBs
CREATE TABLE public.operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  cedente_id UUID NOT NULL REFERENCES public.cedentes(id) ON DELETE RESTRICT,
  sacado_id UUID NOT NULL REFERENCES public.sacados(id) ON DELETE RESTRICT,
  valor_principal NUMERIC(15,2) NOT NULL,
  taxa_mensal NUMERIC(6,4) NOT NULL DEFAULT 0,
  prazo_dias INTEGER NOT NULL DEFAULT 30,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  valor_liquido NUMERIC(15,2),
  status operacao_status NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_operacoes_status ON public.operacoes(status);
CREATE INDEX idx_operacoes_vencimento ON public.operacoes(data_vencimento);
CREATE INDEX idx_operacoes_cedente ON public.operacoes(cedente_id);
CREATE INDEX idx_operacoes_sacado ON public.operacoes(sacado_id);

ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view operacoes" ON public.operacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert operacoes" ON public.operacoes FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Staff update operacoes" ON public.operacoes FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') OR public.has_role(auth.uid(), 'operador')
);
CREATE POLICY "Managers delete operacoes" ON public.operacoes FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
);

CREATE TRIGGER operacoes_updated_at BEFORE UPDATE ON public.operacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();