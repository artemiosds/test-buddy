
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Cache por transação (request) das checagens de acesso -----------------------
CREATE OR REPLACE FUNCTION public.rls_cache_get(_key text)
RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v text;
BEGIN
  v := current_setting('rlsc.' || _key, true);
  IF v IS NULL OR v = '' THEN RETURN NULL; END IF;
  RETURN v = 't';
END $fn$;

CREATE OR REPLACE FUNCTION public.rls_cache_put(_key text, _val boolean)
RETURNS boolean LANGUAGE plpgsql VOLATILE SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
  PERFORM set_config('rlsc.' || _key, CASE WHEN _val THEN 't' ELSE 'f' END, true);
  RETURN _val;
END $fn$;

-- mfa_exigido_nao_atendido ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.mfa_exigido_nao_atendido_core(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
  SELECT
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') = 'aal1'
    AND EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = _user_id AND f.status = 'verified'
    )
    AND COALESCE((
      SELECT (
        COALESCE(p.admin_2fa_required, false)
        OR (u.acesso_todas_unidades AND u.acesso_todas_secretarias)
      )
      FROM public.usuarios u
      LEFT JOIN public.perfis p ON p.id = u.perfil_id
      WHERE u.id = _user_id AND u.deleted_at IS NULL
    ), false);
$fn$;

CREATE OR REPLACE FUNCTION public.mfa_exigido_nao_atendido(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'mfa' || md5(coalesce(_user_id::text, '-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.mfa_exigido_nao_atendido_core(_user_id), false));
END $fn$;

-- is_master ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_master_core(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  _caller uuid := auth.uid();
  _caller_master boolean;
BEGIN
  IF _caller IS NOT NULL AND public.mfa_exigido_nao_atendido(_caller) THEN
    RETURN false;
  END IF;

  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller THEN
    SELECT COALESCE((acesso_todas_unidades AND acesso_todas_secretarias), false)
      INTO _caller_master
      FROM public.usuarios
     WHERE id = _caller AND deleted_at IS NULL AND status = 'ativo';
    IF NOT COALESCE(_caller_master, false) THEN
      RAISE EXCEPTION 'Não autorizado a consultar dados de outro usuário'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN COALESCE((
    SELECT (acesso_todas_unidades AND acesso_todas_secretarias)
    FROM public.usuarios
    WHERE id = _user_id AND deleted_at IS NULL AND status = 'ativo'
  ), false);
END $fn$;

CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'im' || md5(coalesce(_user_id::text, '-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.is_master_core(_user_id), false));
END $fn$;

-- user_has_unit --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_unit_core(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar vínculos de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN
    public.is_master(_user_id)
    OR COALESCE((SELECT acesso_todas_unidades FROM public.usuarios
                 WHERE id = _user_id AND deleted_at IS NULL), false)
    OR EXISTS (
      SELECT 1 FROM public.usuario_unidades
      WHERE usuario_id = _user_id AND unidade_id = _unidade_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
END $fn$;

CREATE OR REPLACE FUNCTION public.user_has_unit(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'uu' || md5(coalesce(_user_id::text,'-') || '|' || coalesce(_unidade_id::text,'-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.user_has_unit_core(_user_id, _unidade_id), false));
END $fn$;

-- user_has_secretaria --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_secretaria_core(_user_id uuid, _secretaria_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _caller uuid := auth.uid();
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar vínculos de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN
    public.is_master(_user_id)
    OR COALESCE((SELECT acesso_todas_secretarias FROM public.usuarios
                 WHERE id = _user_id AND deleted_at IS NULL), false)
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = _user_id AND secretaria_id = _secretaria_id AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.usuario_secretarias
      WHERE usuario_id = _user_id AND secretaria_id = _secretaria_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
END $fn$;

CREATE OR REPLACE FUNCTION public.user_has_secretaria(_user_id uuid, _secretaria_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'us' || md5(coalesce(_user_id::text,'-') || '|' || coalesce(_secretaria_id::text,'-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.user_has_secretaria_core(_user_id, _secretaria_id), false));
END $fn$;

-- has_permission -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission_core(_user_id uuid, _codigo text, _unidade_id uuid DEFAULT NULL::uuid, _secretaria_id uuid DEFAULT NULL::uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE
  _caller uuid := auth.uid();
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _override_unidade BOOLEAN;
  _concedida_perfil BOOLEAN;
  _usuario_ativo BOOLEAN;
BEGIN
  IF _caller IS NOT NULL AND public.mfa_exigido_nao_atendido(_caller) THEN
    RETURN false;
  END IF;

  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar permissões de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL OR _codigo IS NULL THEN
    RETURN false;
  END IF;

  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF public.is_master(_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'revogada' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;
  IF _revogada THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'concedida' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;
  IF _concedida_individual THEN RETURN true; END IF;

  IF _perfil_id IS NULL THEN RETURN false; END IF;

  IF _unidade_id IS NOT NULL THEN
    SELECT concedida INTO _override_unidade
      FROM public.perfil_permissoes_unidade
     WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
       AND unidade_id = _unidade_id;
    IF _override_unidade IS NOT NULL THEN
      RETURN _override_unidade;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.perfil_permissoes
    WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
      AND concedida = true AND deleted_at IS NULL
  ) INTO _concedida_perfil;

  RETURN COALESCE(_concedida_perfil, false);
END $fn$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _codigo text, _unidade_id uuid DEFAULT NULL::uuid, _secretaria_id uuid DEFAULT NULL::uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'hp' || md5(coalesce(_user_id::text,'-') || '|' || coalesce(_codigo,'-') || '|' ||
                    coalesce(_unidade_id::text,'-') || '|' || coalesce(_secretaria_id::text,'-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.has_permission_core(_user_id, _codigo, _unidade_id, _secretaria_id), false));
END $fn$;

-- Índices de busca -----------------------------------------------------------
CREATE INDEX IF NOT EXISTS ix_profissionais_nome_trgm
  ON public.profissionais USING gin (nome_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_profissionais_cpf_trgm
  ON public.profissionais USING gin (cpf gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_profissionais_matricula_trgm
  ON public.profissionais USING gin (matricula gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ix_usuario_unidades_lookup
  ON public.usuario_unidades (usuario_id, unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_usuario_secretarias_lookup
  ON public.usuario_secretarias (usuario_id, secretaria_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_usuario_permissoes_lookup
  ON public.usuario_permissoes (usuario_id, permissao_id) WHERE deleted_at IS NULL;

ANALYZE public.profissionais;
