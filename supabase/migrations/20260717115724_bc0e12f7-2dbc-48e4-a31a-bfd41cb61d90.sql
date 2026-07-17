-- 5C.1: Endurecimento leve de RLS em tabelas sensíveis
-- 1) FORCE RLS nas 4 tabelas auditadas (dono da tabela também passa a respeitar RLS)
ALTER TABLE public.usuarios                  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.usuario_permissoes        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.documentos                FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assinaturas_institucionais FORCE ROW LEVEL SECURITY;

-- 2) documentos_update: fechar edição de documento soft-deletado
--    USING é avaliado na linha ANTES do UPDATE, então o próprio soft-delete
--    (que seta deleted_at a partir de NULL) continua funcionando.
DROP POLICY IF EXISTS documentos_update ON public.documentos;
CREATE POLICY documentos_update ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND has_permission(auth.uid(), 'documento.upload'::text, unidade_id, secretaria_id)
  )
  WITH CHECK (
    has_permission(auth.uid(), 'documento.upload'::text, unidade_id, secretaria_id)
  );