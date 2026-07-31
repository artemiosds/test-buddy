-- 1) SELECT: permite ver removidos para master / quem tem documento.excluir
DROP POLICY IF EXISTS documentos_select ON public.documentos;
CREATE POLICY documentos_select ON public.documentos
FOR SELECT
USING (
  (
    is_master(auth.uid())
    OR (unidade_id IS NOT NULL AND user_has_unit(auth.uid(), unidade_id))
    OR (secretaria_id IS NOT NULL AND user_has_secretaria(auth.uid(), secretaria_id))
  )
  AND (
    deleted_at IS NULL
    OR is_master(auth.uid())
    OR has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
  )
);

-- 2) UPDATE: mantém edição normal e habilita restauração da lixeira
DROP POLICY IF EXISTS documentos_update ON public.documentos;
CREATE POLICY documentos_update ON public.documentos
FOR UPDATE
USING (
  (deleted_at IS NULL AND has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id))
  OR (
    deleted_at IS NOT NULL
    AND (
      is_master(auth.uid())
      OR has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
    )
  )
)
WITH CHECK (
  has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id)
  OR is_master(auth.uid())
  OR has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
);

-- 3) DELETE definitivo: master/documento.excluir OU o próprio autor do upload
DROP POLICY IF EXISTS documentos_delete ON public.documentos;
CREATE POLICY documentos_delete ON public.documentos
FOR DELETE
USING (
  is_master(auth.uid())
  OR has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id)
  OR (
    created_by = auth.uid()
    AND deleted_at IS NULL
    AND has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id)
  )
);

-- 4) Storage: autor do arquivo pode apagar o próprio binário (descarte do rascunho)
DROP POLICY IF EXISTS documentos_delete ON storage.objects;
CREATE POLICY documentos_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'documentos'
  AND (
    is_master(auth.uid())
    OR has_permission(auth.uid(), 'documento.excluir',
        (NULLIF(split_part(name, '/', 2), ''))::uuid,
        (split_part(name, '/', 1))::uuid)
    OR owner = auth.uid()
  )
);
