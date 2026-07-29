-- Verificação central de MFA a nível de banco
CREATE OR REPLACE FUNCTION public.mfa_exigido_nao_atendido(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    -- só se aplica a sessões de usuários finais (authenticated)
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') IS DISTINCT FROM 'aal2'
    AND COALESCE((
      SELECT (
        COALESCE(p.admin_2fa_required, false)
        OR (u.acesso_todas_unidades AND u.acesso_todas_secretarias)
      )
      FROM public.usuarios u
      LEFT JOIN public.perfis p ON p.id = u.perfil_id
      WHERE u.id = _user_id AND u.deleted_at IS NULL
    ), false);
$function$;

GRANT EXECUTE ON FUNCTION public.mfa_exigido_nao_atendido(uuid) TO authenticated, service_role;

-- is_master passa a exigir AAL2 quando o 2FA é obrigatório
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
END;
$function$;

-- has_permission passa a negar tudo enquanto o 2FA obrigatório não for cumprido
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _codigo text,
  _unidade_id uuid DEFAULT NULL,
  _secretaria_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
END;
$function$;