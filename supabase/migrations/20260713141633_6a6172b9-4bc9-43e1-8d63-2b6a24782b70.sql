
DROP POLICY IF EXISTS authenticated_ver_documentos ON public.documentos_assinados;
DROP POLICY IF EXISTS "Ver documentos assinados" ON public.documentos_assinados;
DROP POLICY IF EXISTS documentos_assinados_publico_anon ON public.documentos_assinados;
DROP POLICY IF EXISTS documentos_assinados_select_restrito ON public.documentos_assinados;

CREATE POLICY documentos_assinados_select_restrito
ON public.documentos_assinados
FOR SELECT
TO authenticated
USING (
  assinado_por = auth.uid()
  OR public.is_master(auth.uid())
  OR public.has_permission(auth.uid(), 'documentos.visualizar')
  OR public.has_permission(auth.uid(), 'assinatura.visualizar')
);

DROP VIEW IF EXISTS public.documentos_assinados_publico;
CREATE VIEW public.documentos_assinados_publico
WITH (security_invoker = on) AS
SELECT id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em
FROM public.documentos_assinados;

GRANT SELECT ON public.documentos_assinados_publico TO anon, authenticated;

CREATE POLICY documentos_assinados_publico_anon
ON public.documentos_assinados
FOR SELECT
TO anon
USING (true);

REVOKE ALL ON public.documentos_assinados FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_my_permissions() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_user_context() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_unit(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_has_secretaria(uuid, uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_unit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_secretaria(uuid, uuid) TO authenticated;
