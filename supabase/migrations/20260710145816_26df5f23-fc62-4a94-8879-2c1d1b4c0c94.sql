
-- =====================================================================
-- REFINAMENTO 01a — RECRIAÇÃO DAS TABELAS DA FUNDAÇÃO ORGANIZACIONAL
-- =====================================================================

-- Drop das tabelas existentes (ordem inversa de dependência)
DROP TABLE IF EXISTS public.calendario_institucional CASCADE;
DROP TABLE IF EXISTS public.vinculos CASCADE;
DROP TABLE IF EXISTS public.funcoes CASCADE;
DROP TABLE IF EXISTS public.cargos CASCADE;
DROP TABLE IF EXISTS public.fundos CASCADE;
DROP TABLE IF EXISTS public.setores CASCADE;
DROP TABLE IF EXISTS public.unidades CASCADE;
DROP TABLE IF EXISTS public.municipio_config CASCADE;
DROP TABLE IF EXISTS public.secretarias CASCADE;

-- =====================================================================
-- ENUMS
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE public.status_entidade AS ENUM ('ativa','inativa','suspensa','arquivada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.nivel_cargo AS ENUM ('fundamental','medio','tecnico','superior','pos_graduacao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_data_calendario AS ENUM ('feriado_nacional','feriado_estadual','feriado_municipal','ponto_facultativo','recesso','data_comemorativa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.abrangencia_calendario AS ENUM ('municipal','estadual','nacional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.natureza_vinculo AS ENUM ('estatutario','celetista','comissionado','temporario','terceirizado','estagiario','residente','voluntario');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- SECRETARIAS
-- =====================================================================
CREATE TABLE public.secretarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sigla VARCHAR(20),
  cnpj VARCHAR(14) CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  responsavel_nome TEXT,
  responsavel_email CITEXT,
  responsavel_telefone VARCHAR(20),
  endereco JSONB,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- MUNICIPIO_CONFIG (enriquecida)
-- =====================================================================
CREATE TABLE public.municipio_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id UUID REFERENCES public.secretarias(id) ON DELETE SET NULL,
  nome_municipio TEXT NOT NULL,
  uf VARCHAR(2) NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  codigo_ibge VARCHAR(7) CHECK (codigo_ibge IS NULL OR codigo_ibge ~ '^[0-9]{7}$'),
  cnpj_prefeitura VARCHAR(14) CHECK (cnpj_prefeitura IS NULL OR cnpj_prefeitura ~ '^[0-9]{14}$'),
  razao_social TEXT,
  brasao_url TEXT,
  logotipo_url TEXT,
  site_oficial TEXT,
  endereco JSONB,
  telefone VARCHAR(20),
  email_institucional CITEXT,
  gestor_nome TEXT,
  gestor_cpf VARCHAR(11) CHECK (gestor_cpf IS NULL OR gestor_cpf ~ '^[0-9]{11}$'),
  vice_gestor_nome TEXT,
  vice_gestor_cpf VARCHAR(11) CHECK (vice_gestor_cpf IS NULL OR vice_gestor_cpf ~ '^[0-9]{11}$'),
  secretario_saude_nome TEXT,
  secretario_saude_cpf VARCHAR(11) CHECK (secretario_saude_cpf IS NULL OR secretario_saude_cpf ~ '^[0-9]{11}$'),
  parametros JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- UNIDADES (enriquecida)
-- =====================================================================
CREATE TABLE public.unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  sigla VARCHAR(30),
  cnes VARCHAR(7) CHECK (cnes IS NULL OR cnes ~ '^[0-9]{7}$'),
  cnpj VARCHAR(14) CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  tipo_unidade TEXT,
  nivel_complexidade TEXT CHECK (nivel_complexidade IS NULL OR nivel_complexidade IN ('atencao_basica','media_complexidade','alta_complexidade','apoio','administrativa')),
  horario_funcionamento JSONB,
  capacidade_atendimento INTEGER CHECK (capacidade_atendimento IS NULL OR capacidade_atendimento >= 0),
  telefone VARCHAR(20),
  email_institucional CITEXT,
  endereco JSONB,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  responsavel_nome TEXT,
  responsavel_cpf VARCHAR(11) CHECK (responsavel_cpf IS NULL OR responsavel_cpf ~ '^[0-9]{11}$'),
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- SETORES
-- =====================================================================
CREATE TABLE public.setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  sigla VARCHAR(30),
  responsavel_nome TEXT,
  responsavel_cpf VARCHAR(11) CHECK (responsavel_cpf IS NULL OR responsavel_cpf ~ '^[0-9]{11}$'),
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- FUNDOS
-- =====================================================================
CREATE TABLE public.fundos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  sigla VARCHAR(20),
  cnpj VARCHAR(14) CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  esfera TEXT CHECK (esfera IS NULL OR esfera IN ('municipal','estadual','federal')),
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- CARGOS (enriquecida)
-- =====================================================================
CREATE TABLE public.cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo VARCHAR(30),
  cbo VARCHAR(6) CHECK (cbo IS NULL OR cbo ~ '^[0-9]{4,6}$'),
  nivel public.nivel_cargo,
  grupo_ocupacional TEXT,
  carga_horaria_semanal INTEGER CHECK (carga_horaria_semanal IS NULL OR (carga_horaria_semanal > 0 AND carga_horaria_semanal <= 60)),
  regulamentacao TEXT,
  base_legal TEXT,
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- FUNCOES
-- =====================================================================
CREATE TABLE public.funcoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo VARCHAR(30),
  gratificacao_percentual NUMERIC(6,3) CHECK (gratificacao_percentual IS NULL OR gratificacao_percentual >= 0),
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- VINCULOS (enriquecida)
-- =====================================================================
CREATE TABLE public.vinculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo VARCHAR(30) UNIQUE,
  natureza public.natureza_vinculo,
  categoria TEXT CHECK (categoria IS NULL OR categoria IN ('contratado','efetivo')),
  requer_concurso BOOLEAN NOT NULL DEFAULT false,
  permite_acumulo BOOLEAN NOT NULL DEFAULT false,
  base_legal TEXT,
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- =====================================================================
-- CALENDARIO_INSTITUCIONAL (enriquecida)
-- =====================================================================
CREATE TABLE public.calendario_institucional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  tipo public.tipo_data_calendario NOT NULL,
  abrangencia public.abrangencia_calendario NOT NULL DEFAULT 'municipal',
  ato_normativo TEXT,
  eh_recorrente BOOLEAN NOT NULL DEFAULT false,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (data, descricao, abrangencia)
);

-- =====================================================================
-- GRANTS
-- =====================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.secretarias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipio_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fundos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vinculos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_institucional TO authenticated;

GRANT ALL ON public.secretarias, public.municipio_config, public.unidades, public.setores,
  public.fundos, public.cargos, public.funcoes, public.vinculos, public.calendario_institucional
  TO service_role;

-- =====================================================================
-- RLS habilitado (políticas virão em 01d)
-- =====================================================================
ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendario_institucional ENABLE ROW LEVEL SECURITY;

-- Política temporária permissiva para autenticados (substituída em 01d após has_permission existir)
CREATE POLICY "auth_read_all" ON public.secretarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.municipio_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.unidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.setores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.fundos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.vinculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_all" ON public.calendario_institucional FOR SELECT TO authenticated USING (true);
