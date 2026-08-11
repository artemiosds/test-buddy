-- =========================================================================
-- MIGRAÇÃO CORRETIVA #1: Restaurar get_my_user_context()
-- =========================================================================
-- PROBLEMA IDENTIFICADO:
--   1. is_master usava regra divergente (OR vs AND) — CONFLILO com is_master_core
--   2. unidades não era retornado — Diretor sem unidade autorizada
--   3. perfil_admin_2fa_required faltava em algumas versões
--   4. get_my_user_context() não respeitava a verificação de MFA que
--      is_master_core() aplica (mfa_exigido_nao_atendido_core)
--
-- SOLUÇÃO:
--   Convertendo para JSONB com:
--   - is_master usando regra CORRETA (AND ambas flags) + MFA gate
--   - unidades como array de UUIDs via jsonb_agg()
--   - perfil_admin_2fa_required
--   - Todos os campos existentes preservados
--
-- CONSISTÊNCIA:
--   is_master agora usa a MESMA regra de is_master_core():
--   (acesso_todas_unidades AND acesso_todas_secretarias)
--   com verificação de MFA prévia (mfa_exigido_nao_atendido_core)
-- =========================================================================

DROP FUNCTION IF EXISTS public.get_my_user_context();

CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _result jsonb;
  _is_master boolean;
  _unidades jsonb;
BEGIN
  IF _caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- Resolver is_master usando a regra CORRETA e CONSISTENTE com is_master_core:
  --   1. Se MFA obrigatório não atendido → false (mesmo que is_master_core)
  --   2. (acesso_todas_unidades AND acesso_todas_secretarias)
  IF public.mfa_exigido_nao_atendido_core(_caller) THEN
    _is_master := false;
  ELSE
    SELECT COALESCE(
      (acesso_todas_unidades AND acesso_todas_secretarias),
      false
    ) INTO _is_master
    FROM public.usuarios u
    WHERE u.id = _caller
      AND u.deleted_at IS NULL
      AND u.status = 'ativo';
  END IF;

  -- Buscar unidades autorizadas do usuario_unidades (ativas, não expiradas)
  SELECT COALESCE(
    jsonb_agg(DISTINCT uu.unidade_id),
    '[]'::jsonb
  ) INTO _unidades
  FROM public.usuario_unidades uu
  WHERE uu.usuario_id = _caller
    AND uu.deleted_at IS NULL
    AND (uu.data_fim IS NULL OR uu.data_fim >= CURRENT_DATE);

  -- Montar resultado como JSONB (único objeto, não array)
  SELECT jsonb_build_object(
    'id', u.id,
    'nome_completo', u.nome_completo,
    'email', u.email,
    'status', u.status,
    'perfil_id', u.perfil_id,
    'perfil_codigo', p.codigo,
    'perfil_nome', p.nome,
    'secretaria_id', u.secretaria_id,
    'acesso_todas_unidades', COALESCE(u.acesso_todas_unidades, false),
    'acesso_todas_secretarias', COALESCE(u.acesso_todas_secretarias, false),
    'is_master', COALESCE(_is_master, false),
    'perfil_admin_2fa_required', COALESCE(p.admin_2fa_required, false),
    'unidades', COALESCE(_unidades, '[]'::jsonb)
  ) INTO _result
  FROM public.usuarios u
  LEFT JOIN public.perfis p ON u.perfil_id = p.id
  WHERE u.id = _caller
    AND u.deleted_at IS NULL
    AND u.status = 'ativo';

  RETURN _result;
END $function$;

GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;

-- =========================================================================
-- VERIFICAÇÃO (executar no SQL Editor):
--   SELECT public.get_my_user_context() as ctx;
--   Deve retornar um JSONB com: id, nome_completo, ..., is_master, unidades,
--   perfil_admin_2fa_required
-- =========================================================================
