-- 1. DROP old ambiguous signature
DROP FUNCTION IF EXISTS public.has_permission_core(uuid, text);

-- 2. CREATE/REPLACE official consolidated signature
CREATE OR REPLACE FUNCTION public.has_permission_core(
    _user_id uuid, 
    _codigo text, 
    _unidade_id uuid DEFAULT NULL, 
    _secretaria_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _usuario_ativo BOOLEAN;
  _concedida_perfil BOOLEAN;
BEGIN
  -- FASE 7: MASTER (Fonte de verdade administrativa is_master_db)
  IF public.is_master_db(_user_id) THEN
    RETURN true;
  END IF;

  -- FASE 3: AUDITORIA SCHEMA
  -- Validando usuário
  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  -- Buscando ID da permissão
  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  -- FASE 4: REGRA DE REVOGAÇÃO (Prioridade Máxima)
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'revogada' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      -- Se unidade/secretaria for informada, a revogação pode ser específica ou global (NULL)
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;
  
  IF _revogada THEN 
    RETURN false; 
  END IF;

  -- FASE 5: CONCESSÃO INDIVIDUAL
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'concedida' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;
  
  IF _concedida_individual THEN 
    RETURN true; 
  END IF;

  -- FASE 6: HERANÇA DO PERFIL
  IF _perfil_id IS NOT NULL THEN
    -- Primeiro checa override por unidade se unidade_id foi fornecido
    IF _unidade_id IS NOT NULL THEN
      SELECT concedida INTO _concedida_perfil
        FROM public.perfil_permissoes_unidade
       WHERE perfil_id = _perfil_id 
         AND permissao_id = _perm_id
         AND unidade_id = _unidade_id;
      
      IF _concedida_perfil IS NOT NULL THEN
        RETURN _concedida_perfil;
      END IF;
    END IF;

    -- Fallback para permissão geral do perfil
    SELECT EXISTS (
      SELECT 1 FROM public.perfil_permissoes
      WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
    ) INTO _concedida_perfil;
    
    IF _concedida_perfil THEN 
      RETURN true; 
    END IF;
  END IF;

  RETURN false;
END $$;

-- 3. GRANT permissions
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO service_role;

-- 4. Re-auditar wrapper has_permission para garantir que aponta para a nova assinatura
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
AS $$
DECLARE _k text; _c boolean;
BEGIN
  _k := 'hp' || md5(coalesce(_user_id::text,'-') || '|' || coalesce(_codigo,'-') || '|' ||
                    coalesce(_unidade_id::text,'-') || '|' || coalesce(_secretaria_id::text,'-'));
  _c := public.rls_cache_get(_k);
  IF _c IS NOT NULL THEN RETURN _c; END IF;
  RETURN public.rls_cache_put(_k, coalesce(public.has_permission_core(_user_id, _codigo, _unidade_id, _secretaria_id), false));
END $$;