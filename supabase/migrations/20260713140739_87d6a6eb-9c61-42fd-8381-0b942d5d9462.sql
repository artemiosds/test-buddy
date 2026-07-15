
-- =========================================================================
-- HARDENING SPRINT — ETAPA 1: RLS + Views + Function EXECUTE
-- =========================================================================

-- 1) documentos_assinados: remover leak "authenticated USING (true)"
DROP POLICY IF EXISTS authenticated_ver_documentos ON public.documentos_assinados;

-- SELECT restrito: o próprio signatário, MASTER, ou quem gerencia assinaturas
CREATE POLICY documentos_assinados_select
  ON public.documentos_assinados
  FOR SELECT
  TO authenticated
  USING (
    assinado_por = auth.uid()
    OR public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'assinatura.gerenciar')
    OR public.has_permission(auth.uid(), 'auditoria.visualizar')
  );

-- Bloquear UPDATE/DELETE explicitamente (documentos assinados são imutáveis)
CREATE POLICY documentos_assinados_no_update
  ON public.documentos_assinados
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY documentos_assinados_no_delete
  ON public.documentos_assinados
  FOR DELETE
  TO authenticated
  USING (public.is_master(auth.uid()));

-- 2) View pública: security_invoker=on + policy anon com colunas seguras
ALTER VIEW public.documentos_assinados_publico SET (security_invoker = on);

-- Grant column-level para anon (dados_json NUNCA é concedido)
GRANT SELECT (id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em)
  ON public.documentos_assinados TO anon;

-- Policy anon restrita: só as colunas acima podem ser lidas graças ao column grant.
-- USING (true) é seguro aqui porque não há SELECT total-columns concedido a anon.
CREATE POLICY documentos_assinados_publico_anon
  ON public.documentos_assinados
  FOR SELECT
  TO anon
  USING (true);

-- 3) SECURITY DEFINER: revogar EXECUTE de anon/public em funções internas
REVOKE EXECUTE ON FUNCTION public.get_my_permissions()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_user_context()         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_unit(uuid, uuid)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_has_secretaria(uuid, uuid) FROM PUBLIC, anon;

-- Trigger functions: nunca devem ser chamadas diretamente
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_by()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_audit_row()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_usuarios_atribuir_perfil_padrao()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_usuarios_master_guard()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_freq_prof_guard_analise()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_competencias_auto_vincular_unidades() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                      FROM PUBLIC, anon, authenticated;

-- 4) Reafirmar: nenhuma tabela sensível concede acesso a anon
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r'
      AND c.relname <> 'documentos_assinados'  -- exceção: column-grant já feito
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tname);
  END LOOP;
END$$;
