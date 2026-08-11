-- PASSO 1 e 3: Corrigir policies que referenciam deleted_at em tabelas que não a possuem
-- Tabelas confirmadas SEM deleted_at: perfil_permissoes, perfil_permissoes_unidade

-- Corrigindo has_permission_core (que usa perfil_permissoes)
CREATE OR REPLACE FUNCTION public.has_permission_core(_user_id uuid, _codigo text, _unidade_id uuid DEFAULT NULL::uuid, _secretaria_id uuid DEFAULT NULL::uuid)
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
    -- Removido filtro de deleted_at pois a tabela perfil_permissoes_unidade não possui a coluna
    IF _override_unidade IS NOT NULL THEN
      RETURN _override_unidade;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.perfil_permissoes
    WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
      AND concedida = true
      -- Removido filtro de deleted_at pois a tabela perfil_permissoes não possui a coluna
  ) INTO _concedida_perfil;

  RETURN COALESCE(_concedida_perfil, false);
END $function$;

-- Corrigindo a versão simplificada de has_permission_core que também usa perfil_permissoes
CREATE OR REPLACE FUNCTION public.has_permission_core(_user_id uuid, _perm_codigo text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- MASTER sempre possui autorização total
  IF public.is_master(_user_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios u
    JOIN public.perfil_permissoes pp ON u.perfil_id = pp.perfil_id
    JOIN public.permissoes p ON pp.permissao_id = p.id
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND p.codigo = _perm_codigo
      -- Removido pp.deleted_at IS NULL (perfil_permissoes não tem a coluna)
  );
END $function$;
