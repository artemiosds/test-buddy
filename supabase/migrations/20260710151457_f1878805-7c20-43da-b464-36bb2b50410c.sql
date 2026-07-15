
-- =====================================================================
-- MIGRATION 02.03 — PERMISSÕES
-- =====================================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.modulo_sistema AS ENUM (
    'dashboard','competencia','frequencia','relatorio','usuario','auditoria',
    'configuracao','documento','notificacao','assinatura','profissional',
    'unidade','secretaria','perfil','permissao','sistema'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.categoria_permissao AS ENUM (
    'visualizacao','criacao','edicao','exclusao','aprovacao','exportacao','administracao','acao'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_permissao_usuario AS ENUM ('concedida','revogada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.origem_permissao AS ENUM ('perfil','individual','temporaria','delegada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- PERMISSÕES (catálogo)
-- =====================================================================
CREATE TABLE public.permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  modulo public.modulo_sistema NOT NULL,
  categoria public.categoria_permissao NOT NULL,
  ativa BOOLEAN NOT NULL DEFAULT true,
  is_sistema BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_permissoes_codigo_formato CHECK (codigo ~ '^[a-z_]+\.[a-z_]+$')
);

CREATE UNIQUE INDEX ux_permissoes_codigo_ativo ON public.permissoes(codigo) WHERE deleted_at IS NULL;
CREATE INDEX ix_permissoes_modulo ON public.permissoes(modulo) WHERE deleted_at IS NULL;
CREATE INDEX ix_permissoes_categoria ON public.permissoes(categoria) WHERE deleted_at IS NULL;
CREATE INDEX ix_permissoes_ativa ON public.permissoes(ativa) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes TO authenticated;
GRANT ALL ON public.permissoes TO service_role;

ALTER TABLE public.permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_permissoes" ON public.permissoes FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_permissoes_set_updated_at BEFORE UPDATE ON public.permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_permissoes_set_updated_by BEFORE UPDATE ON public.permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- =====================================================================
-- PERFIL x PERMISSÕES
-- =====================================================================
CREATE TABLE public.perfil_permissoes (
  perfil_id UUID NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  concedida BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (perfil_id, permissao_id)
);

CREATE INDEX ix_perfil_permissoes_permissao ON public.perfil_permissoes(permissao_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfil_permissoes TO authenticated;
GRANT ALL ON public.perfil_permissoes TO service_role;

ALTER TABLE public.perfil_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_perfil_permissoes" ON public.perfil_permissoes FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_perfil_permissoes_set_updated_at BEFORE UPDATE ON public.perfil_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_perfil_permissoes_set_updated_by BEFORE UPDATE ON public.perfil_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- =====================================================================
-- USUÁRIO x PERMISSÕES (controle principal)
-- =====================================================================
CREATE TABLE public.usuario_permissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  permissao_id UUID NOT NULL REFERENCES public.permissoes(id) ON DELETE CASCADE,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE CASCADE,
  secretaria_id UUID REFERENCES public.secretarias(id) ON DELETE CASCADE,
  tipo public.tipo_permissao_usuario NOT NULL DEFAULT 'concedida',
  origem public.origem_permissao NOT NULL DEFAULT 'individual',
  valido_de TIMESTAMPTZ NOT NULL DEFAULT now(),
  valido_ate TIMESTAMPTZ,
  motivo TEXT,
  concedida_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  concedida_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ck_usuario_permissoes_validade CHECK (valido_ate IS NULL OR valido_ate > valido_de)
);

-- Unicidade parcial considerando escopo (NULL tratado como valor via COALESCE de UUID zero)
CREATE UNIQUE INDEX ux_usuario_permissoes_escopo_ativo
  ON public.usuario_permissoes (
    usuario_id,
    permissao_id,
    COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(secretaria_id, '00000000-0000-0000-0000-000000000000'::uuid),
    tipo
  ) WHERE deleted_at IS NULL;

CREATE INDEX ix_usuario_permissoes_usuario ON public.usuario_permissoes(usuario_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuario_permissoes_permissao ON public.usuario_permissoes(permissao_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuario_permissoes_unidade ON public.usuario_permissoes(unidade_id) WHERE deleted_at IS NULL AND unidade_id IS NOT NULL;
CREATE INDEX ix_usuario_permissoes_secretaria ON public.usuario_permissoes(secretaria_id) WHERE deleted_at IS NULL AND secretaria_id IS NOT NULL;
CREATE INDEX ix_usuario_permissoes_validade ON public.usuario_permissoes(valido_de, valido_ate) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuario_permissoes_tipo ON public.usuario_permissoes(tipo) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_permissoes TO authenticated;
GRANT ALL ON public.usuario_permissoes TO service_role;

ALTER TABLE public.usuario_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_ve_proprias_permissoes" ON public.usuario_permissoes
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE TRIGGER trg_usuario_permissoes_set_updated_at BEFORE UPDATE ON public.usuario_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_usuario_permissoes_set_updated_by BEFORE UPDATE ON public.usuario_permissoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
