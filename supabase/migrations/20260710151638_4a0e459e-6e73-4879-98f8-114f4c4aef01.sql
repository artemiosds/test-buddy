
-- =====================================================================
-- MIGRATION 02.04 — VÍNCULOS DE ESCOPO E FUNÇÕES AUXILIARES
-- =====================================================================

-- =====================================================================
-- USUÁRIO x UNIDADES
-- =====================================================================
CREATE TABLE public.usuario_unidades (
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (usuario_id, unidade_id),
  CONSTRAINT ck_usuario_unidades_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX ix_usuario_unidades_unidade ON public.usuario_unidades(unidade_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_usuario_unidades_principal ON public.usuario_unidades(usuario_id) WHERE is_principal = true AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_unidades TO authenticated;
GRANT ALL ON public.usuario_unidades TO service_role;

ALTER TABLE public.usuario_unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_ve_proprias_unidades" ON public.usuario_unidades
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE TRIGGER trg_usuario_unidades_set_updated_at BEFORE UPDATE ON public.usuario_unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_usuario_unidades_set_updated_by BEFORE UPDATE ON public.usuario_unidades
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- =====================================================================
-- USUÁRIO x SECRETARIAS
-- =====================================================================
CREATE TABLE public.usuario_secretarias (
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  is_principal BOOLEAN NOT NULL DEFAULT false,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (usuario_id, secretaria_id),
  CONSTRAINT ck_usuario_secretarias_periodo CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX ix_usuario_secretarias_secretaria ON public.usuario_secretarias(secretaria_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_usuario_secretarias_principal ON public.usuario_secretarias(usuario_id) WHERE is_principal = true AND deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_secretarias TO authenticated;
GRANT ALL ON public.usuario_secretarias TO service_role;

ALTER TABLE public.usuario_secretarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuario_ve_proprias_secretarias" ON public.usuario_secretarias
  FOR SELECT TO authenticated USING (usuario_id = auth.uid());

CREATE TRIGGER trg_usuario_secretarias_set_updated_at BEFORE UPDATE ON public.usuario_secretarias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_usuario_secretarias_set_updated_by BEFORE UPDATE ON public.usuario_secretarias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- =====================================================================
-- FUNÇÕES AUXILIARES
-- =====================================================================

-- Verifica se o usuário é MASTER (acesso irrestrito)
CREATE OR REPLACE FUNCTION public.is_master(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT (acesso_todas_unidades AND acesso_todas_secretarias)
    FROM public.usuarios
    WHERE id = _user_id AND deleted_at IS NULL AND status = 'ativo'
  ), false);
$$;

-- Verifica se o usuário tem acesso a uma unidade
CREATE OR REPLACE FUNCTION public.user_has_unit(_user_id UUID, _unidade_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- MASTER acessa tudo
    public.is_master(_user_id)
    OR
    -- Usuário com flag de todas unidades
    COALESCE((SELECT acesso_todas_unidades FROM public.usuarios WHERE id = _user_id AND deleted_at IS NULL), false)
    OR
    -- Vínculo explícito
    EXISTS (
      SELECT 1 FROM public.usuario_unidades
      WHERE usuario_id = _user_id
        AND unidade_id = _unidade_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
$$;

-- Verifica se o usuário tem acesso a uma secretaria
CREATE OR REPLACE FUNCTION public.user_has_secretaria(_user_id UUID, _secretaria_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.is_master(_user_id)
    OR
    COALESCE((SELECT acesso_todas_secretarias FROM public.usuarios WHERE id = _user_id AND deleted_at IS NULL), false)
    OR
    -- Secretaria principal do usuário
    EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = _user_id AND secretaria_id = _secretaria_id AND deleted_at IS NULL
    )
    OR
    -- Vínculo múltiplo
    EXISTS (
      SELECT 1 FROM public.usuario_secretarias
      WHERE usuario_id = _user_id
        AND secretaria_id = _secretaria_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
$$;

-- Verifica se o usuário possui uma permissão em um escopo
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID,
  _codigo TEXT,
  _unidade_id UUID DEFAULT NULL,
  _secretaria_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _concedida_perfil BOOLEAN;
  _usuario_ativo BOOLEAN;
BEGIN
  IF _user_id IS NULL OR _codigo IS NULL THEN
    RETURN false;
  END IF;

  -- Verifica se o usuário existe e está ativo
  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- MASTER passa por tudo
  IF public.is_master(_user_id) THEN
    RETURN true;
  END IF;

  -- Localiza a permissão
  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  -- 1) Revogação individual válida no escopo tem precedência absoluta
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id
      AND permissao_id = _perm_id
      AND tipo = 'revogada'
      AND deleted_at IS NULL
      AND valido_de <= now()
      AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;

  IF _revogada THEN
    RETURN false;
  END IF;

  -- 2) Concessão individual válida
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id
      AND permissao_id = _perm_id
      AND tipo = 'concedida'
      AND deleted_at IS NULL
      AND valido_de <= now()
      AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;

  IF _concedida_individual THEN
    RETURN true;
  END IF;

  -- 3) Fallback pelo perfil
  IF _perfil_id IS NOT NULL THEN
    SELECT COALESCE(concedida, false) INTO _concedida_perfil
    FROM public.perfil_permissoes
    WHERE perfil_id = _perfil_id AND permissao_id = _perm_id;

    RETURN COALESCE(_concedida_perfil, false);
  END IF;

  RETURN false;
END;
$$;

-- Segurança das funções
REVOKE EXECUTE ON FUNCTION public.is_master(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_unit(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_secretaria(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, UUID, UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_master(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_unit(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_secretaria(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, UUID, UUID) TO authenticated;
