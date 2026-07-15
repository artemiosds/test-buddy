
-- =========================================================
-- Migration 01 — Fundação organizacional
-- Utilitários + Secretaria/Município + Unidades/Setores + Referências (cargos,
-- funções, vínculos, fundos) + Calendário Institucional.
-- Sem dependências fora de auth.users. Pré-requisito de todas as demais.
-- =========================================================

-- Extensões utilitárias (pgcrypto para gen_random_uuid, citext para e-mails,
-- pg_trgm para busca por nome). btree_gist para exclusões futuras.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ---------------------------------------------------------
-- Função utilitária: atualiza updated_at em qualquer trigger BEFORE UPDATE
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- SECRETARIAS
-- =========================================================
CREATE TABLE public.secretarias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          text NOT NULL,
  sigla         text NOT NULL,
  cnpj          text,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid,
  updated_by    uuid,
  deleted_at    timestamptz,
  deleted_by    uuid,
  CONSTRAINT secretarias_sigla_unique UNIQUE (sigla)
);
CREATE INDEX secretarias_ativo_idx ON public.secretarias(ativo) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.secretarias TO authenticated;
GRANT ALL ON public.secretarias TO service_role;
ALTER TABLE public.secretarias ENABLE ROW LEVEL SECURITY;

-- Política transitória: qualquer usuário autenticado pode ler; escrita será
-- restringida na Migration 02 quando has_permission() estiver disponível.
CREATE POLICY "secretarias_select_authenticated"
  ON public.secretarias FOR SELECT TO authenticated USING (true);
CREATE POLICY "secretarias_write_service_role"
  ON public.secretarias FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_secretarias_updated_at
  BEFORE UPDATE ON public.secretarias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- UNIDADES
-- =========================================================
CREATE TABLE public.unidades (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id  uuid NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  nome           text NOT NULL,
  sigla          text NOT NULL,
  cnes           text,
  tipo           text NOT NULL DEFAULT 'OUTRO'
                   CHECK (tipo IN ('UBS','HOSPITAL','CAPS','SAMU','ADMIN','OUTRO')),
  endereco       jsonb NOT NULL DEFAULT '{}'::jsonb,
  telefones      jsonb NOT NULL DEFAULT '[]'::jsonb,
  email          citext,
  ativo          boolean NOT NULL DEFAULT true,
  observacoes    text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz,
  deleted_by     uuid,
  CONSTRAINT unidades_sigla_por_secretaria UNIQUE (secretaria_id, sigla)
);
CREATE UNIQUE INDEX unidades_cnes_unique
  ON public.unidades(cnes) WHERE cnes IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX unidades_secretaria_ativo_idx
  ON public.unidades(secretaria_id, ativo) WHERE deleted_at IS NULL;
CREATE INDEX unidades_nome_trgm_idx
  ON public.unidades USING gin (nome gin_trgm_ops);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades TO authenticated;
GRANT ALL ON public.unidades TO service_role;
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_select_authenticated"
  ON public.unidades FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "unidades_write_service_role"
  ON public.unidades FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_unidades_updated_at
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- SETORES
-- =========================================================
CREATE TABLE public.setores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  sigla       text,
  ativo       boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,
  deleted_by  uuid,
  CONSTRAINT setores_nome_por_unidade UNIQUE (unidade_id, nome)
);
CREATE INDEX setores_unidade_ativo_idx
  ON public.setores(unidade_id, ativo) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.setores TO authenticated;
GRANT ALL ON public.setores TO service_role;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "setores_select_authenticated"
  ON public.setores FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "setores_write_service_role"
  ON public.setores FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_setores_updated_at
  BEFORE UPDATE ON public.setores
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- FUNDOS (fontes de recurso)
-- =========================================================
CREATE TABLE public.fundos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL,
  nome        text NOT NULL,
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,
  deleted_by  uuid,
  CONSTRAINT fundos_codigo_unique UNIQUE (codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fundos TO authenticated;
GRANT ALL ON public.fundos TO service_role;
ALTER TABLE public.fundos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fundos_select_authenticated"
  ON public.fundos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "fundos_write_service_role"
  ON public.fundos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_fundos_updated_at
  BEFORE UPDATE ON public.fundos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- CARGOS
-- =========================================================
CREATE TABLE public.cargos (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 text NOT NULL,
  nome                   text NOT NULL,
  descricao              text,
  carga_horaria_padrao   integer,
  ativo                  boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid,
  deleted_at             timestamptz,
  deleted_by             uuid,
  CONSTRAINT cargos_codigo_unique UNIQUE (codigo),
  CONSTRAINT cargos_carga_horaria_valida CHECK (carga_horaria_padrao IS NULL OR carga_horaria_padrao > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cargos TO authenticated;
GRANT ALL ON public.cargos TO service_role;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargos_select_authenticated"
  ON public.cargos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "cargos_write_service_role"
  ON public.cargos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_cargos_updated_at
  BEFORE UPDATE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- FUNCOES
-- =========================================================
CREATE TABLE public.funcoes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL,
  nome        text NOT NULL,
  descricao   text,
  ativo       boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid,
  updated_by  uuid,
  deleted_at  timestamptz,
  deleted_by  uuid,
  CONSTRAINT funcoes_codigo_unique UNIQUE (codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes TO authenticated;
GRANT ALL ON public.funcoes TO service_role;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funcoes_select_authenticated"
  ON public.funcoes FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "funcoes_write_service_role"
  ON public.funcoes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_funcoes_updated_at
  BEFORE UPDATE ON public.funcoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- VINCULOS (tipos de vínculo funcional; controlam em qual frequência entra)
-- =========================================================
CREATE TABLE public.vinculos (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                          text NOT NULL,
  nome                            text NOT NULL,
  descricao                       text,
  entra_frequencia_contratados    boolean NOT NULL DEFAULT false,
  entra_frequencia_efetivos       boolean NOT NULL DEFAULT false,
  ativo                           boolean NOT NULL DEFAULT true,
  sistema                         boolean NOT NULL DEFAULT false,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  created_by                      uuid,
  updated_by                      uuid,
  deleted_at                      timestamptz,
  deleted_by                      uuid,
  CONSTRAINT vinculos_codigo_unique UNIQUE (codigo),
  CONSTRAINT vinculos_frequencia_definida
    CHECK (entra_frequencia_contratados OR entra_frequencia_efetivos)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vinculos TO authenticated;
GRANT ALL ON public.vinculos TO service_role;
ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vinculos_select_authenticated"
  ON public.vinculos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "vinculos_write_service_role"
  ON public.vinculos FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_vinculos_updated_at
  BEFORE UPDATE ON public.vinculos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed inicial de vínculos (categorias de sistema — sistema=true não podem ser
-- removidas pela UI).
INSERT INTO public.vinculos (codigo, nome, entra_frequencia_contratados, entra_frequencia_efetivos, sistema) VALUES
  ('CONTRATADO',   'Contratado',   true,  false, true),
  ('EFETIVO',      'Efetivo',      false, true,  true),
  ('TEMPORARIO',   'Temporário',   true,  false, true),
  ('COMISSIONADO', 'Comissionado', false, true,  true);

-- =========================================================
-- CALENDARIO INSTITUCIONAL
-- =========================================================
CREATE TABLE public.calendario_institucional (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id  uuid NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  unidade_id     uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  data           date NOT NULL,
  tipo           text NOT NULL
                   CHECK (tipo IN ('UTIL','FIM_DE_SEMANA','FERIADO_NACIONAL',
                                    'FERIADO_ESTADUAL','FERIADO_MUNICIPAL',
                                    'PONTO_FACULTATIVO','RECESSO')),
  abrangencia    text NOT NULL DEFAULT 'GERAL' CHECK (abrangencia IN ('GERAL','POR_UNIDADE')),
  descricao      text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  updated_by     uuid,
  deleted_at     timestamptz,
  deleted_by     uuid,
  CONSTRAINT calendario_abrangencia_unidade_ok
    CHECK ((abrangencia = 'GERAL' AND unidade_id IS NULL)
        OR (abrangencia = 'POR_UNIDADE' AND unidade_id IS NOT NULL))
);
CREATE UNIQUE INDEX calendario_geral_unique
  ON public.calendario_institucional(secretaria_id, data)
  WHERE abrangencia = 'GERAL' AND deleted_at IS NULL;
CREATE UNIQUE INDEX calendario_unidade_unique
  ON public.calendario_institucional(secretaria_id, unidade_id, data)
  WHERE abrangencia = 'POR_UNIDADE' AND deleted_at IS NULL;
CREATE INDEX calendario_data_idx
  ON public.calendario_institucional(secretaria_id, data)
  WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendario_institucional TO authenticated;
GRANT ALL ON public.calendario_institucional TO service_role;
ALTER TABLE public.calendario_institucional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendario_select_authenticated"
  ON public.calendario_institucional FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "calendario_write_service_role"
  ON public.calendario_institucional FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_calendario_updated_at
  BEFORE UPDATE ON public.calendario_institucional
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- MUNICIPIO_CONFIG (dados institucionais, 1 por secretaria)
-- Depende de secretarias. Não referencia documentos ainda; brasão/logo serão
-- FKs adicionadas na Migration 07 (documentos) via ALTER TABLE.
-- =========================================================
CREATE TABLE public.municipio_config (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id          uuid NOT NULL UNIQUE REFERENCES public.secretarias(id) ON DELETE CASCADE,
  nome_municipio         text NOT NULL,
  uf                     char(2) NOT NULL,
  codigo_ibge            text,
  cnes_principal         text,
  cnpj_prefeitura        text,
  endereco               jsonb NOT NULL DEFAULT '{}'::jsonb,
  telefones              jsonb NOT NULL DEFAULT '[]'::jsonb,
  email_institucional    citext,
  site                   text,
  prefeito_nome          text,
  secretario_nome        text,
  secretario_cargo       text,
  lei_criacao            text,
  brasao_documento_id    uuid,   -- FK adicionada na Migration 07
  logotipo_documento_id  uuid,   -- FK adicionada na Migration 07
  observacoes            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid,
  updated_by             uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.municipio_config TO authenticated;
GRANT ALL ON public.municipio_config TO service_role;
ALTER TABLE public.municipio_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "municipio_config_select_authenticated"
  ON public.municipio_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "municipio_config_write_service_role"
  ON public.municipio_config FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_municipio_config_updated_at
  BEFORE UPDATE ON public.municipio_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- COMENTÁRIOS de domínio para documentação
-- =========================================================
COMMENT ON TABLE public.secretarias IS 'Raiz multi-tenant. Uma instalação pode servir várias secretarias.';
COMMENT ON TABLE public.municipio_config IS 'Dados institucionais do município (usados em documentos e relatórios).';
COMMENT ON TABLE public.unidades IS 'Unidades de saúde do município (UBS, hospitais, CAPS, SAMU, admin).';
COMMENT ON TABLE public.setores IS 'Subdivisões internas de uma unidade.';
COMMENT ON TABLE public.fundos IS 'Fontes orçamentárias para agrupar frequências.';
COMMENT ON TABLE public.cargos IS 'Cargos institucionais.';
COMMENT ON TABLE public.funcoes IS 'Funções (atribuição efetiva) — distintas de cargo.';
COMMENT ON TABLE public.vinculos IS 'Tipos de vínculo funcional; controla em qual frequência (Contratados/Efetivos) o profissional entra.';
COMMENT ON TABLE public.calendario_institucional IS 'Feriados, pontos facultativos, recessos e dias úteis usados na conferência da frequência.';
