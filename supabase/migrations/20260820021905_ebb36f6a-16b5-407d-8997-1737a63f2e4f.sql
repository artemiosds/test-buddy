GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;

DROP POLICY IF EXISTS documentos_select ON public.documentos;
CREATE POLICY documentos_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    OR created_by = auth.uid()
    OR public.has_permission(auth.uid(), 'documento.visualizar', unidade_id, secretaria_id)
  );

DROP POLICY IF EXISTS documentos_update ON public.documentos;
CREATE POLICY documentos_update ON public.documentos
  FOR UPDATE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR created_by = auth.uid()
    OR public.has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id)
    OR public.has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
  )
  WITH CHECK (
    public.is_master(auth.uid())
    OR created_by = auth.uid()
    OR public.has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id)
    OR public.has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
  );

DROP POLICY IF EXISTS documentos_delete ON public.documentos;
CREATE POLICY documentos_delete ON public.documentos
  FOR DELETE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
  );