-- =========================================================================
-- MIGRAÇÃO CORRETIVA #2: Sincronizar get_my_permissions() com is_master_core
-- =========================================================================
-- PROBLEMA:
--   get_my_permissions() usava a regra correta (AND ambas flags) para is_master,
--   mas NÃO respeitava a verificação de MFA que is_master_core() e
--   has_permission() aplicam via mfa_exigido_nao_atendido_core().
--   Isso criava divergência: um usuário com 2FA obrigatório mas não
--   autenticado via AAL2 poderia receber permissões via get_my_permissions()
--   enquanto is_master_core() e has_permission() retornariam false.
--
-- SOLUÇÃO:
--   Adicionar o gate de MFA no início de get_my_permissions():
--   - Se mfa_exigido_nao_atendido_core(auth.uid()) → retorna conjunto vazio
--   - Mantém a regra is_master = (acesso_todas_unidades AND acesso_todas_secretarias)
--
-- CONSISTÊNCIA GARANTIDA:
--   get_my_permissions() agora concorda com is_master_core() e has_permission():
--   - MFA não atendido → nenhuma permissão concedida
--   - MASTER (ambas flags + MFA OK) → todas as permissões
--   - Não-MASTER → apenas permissões concedidas/revogadas via perfil ou individual
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _mfa_bloqueado boolean;
BEGIN
  -- Gate de MFA: se o 2FA é obrigatório e não foi atendido, nega tudo.
  -- Consistência com is_master_core() e has_permission_core().
  IF _caller IS NOT NULL THEN
    SELECT public.mfa_exigido_nao_atendido_core(_caller) INTO _mfa_bloqueado;
    IF COALESCE(_mfa_bloqueado, false) THEN
      RETURN QUERY SELECT NULL::text WHERE false;
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH me AS (
    SELECT u.id, u.perfil_id, u.status, u.deleted_at,
           -- Usar a MESMA regra que is_master_core: AMBAS as flags
           (u.acesso_todas_unidades AND u.acesso_todas_secretarias) AS is_master
    FROM public.usuarios u
    WHERE u.id = _caller
  )
  SELECT p.codigo
  FROM public.permissoes p, me
  WHERE p.ativa = true
    AND p.deleted_at IS NULL
    AND me.deleted_at IS NULL
    AND me.status = 'ativo'
    AND (
      me.is_master
      OR (
        -- concessão individual válida
        EXISTS (
          SELECT 1 FROM public.usuario_permissoes up
          WHERE up.usuario_id = me.id
            AND up.permissao_id = p.id
            AND up.tipo = 'concedida'
            AND up.deleted_at IS NULL
            AND up.valido_de <= now()
            AND (up.valido_ate IS NULL OR up.valido_ate > now())
        )
        OR (
          -- concessão via perfil
          EXISTS (
            SELECT 1 FROM public.perfil_permissoes pp
            WHERE pp.perfil_id = me.perfil_id
              AND pp.perfil_id IS NOT NULL
              AND pp.permissao_id = p.id
              AND pp.concedida = true
              AND pp.deleted_at IS NULL
          )
          -- e sem revogação individual ativa
          AND NOT EXISTS (
            SELECT 1 FROM public.usuario_permissoes up2
            WHERE up2.usuario_id = me.id
              AND up2.permissao_id = p.id
              AND up2.tipo = 'revogada'
              AND up2.deleted_at IS NULL
              AND up2.valido_de <= now()
              AND (up2.valido_ate IS NULL OR up2.valido_ate > now())
          )
        )
      )
    );
END $function$;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- =========================================================================
-- VERIFICAÇÃO: ambas as funções devem concordar sobre is_master
--   SELECT (get_my_user_context() -> 'is_master') as ctx_master;
--   SELECT EXISTS (
--     SELECT 1 FROM public.get_my_permissions() gp
--     WHERE EXISTS (SELECT 1 FROM public.permissoes p WHERE p.codigo = gp)
--   ) as perms_concedidas;
--
-- MASTER + AAL2:        is_master=true, todas as permissões
-- MASTER sem MFA:       is_master=false, nenhuma permissão (bloqueado por MFA)
-- NÃO-MASTER + MFA OK:  is_master=false, apenas permissões concedidas
-- =========================================================================
