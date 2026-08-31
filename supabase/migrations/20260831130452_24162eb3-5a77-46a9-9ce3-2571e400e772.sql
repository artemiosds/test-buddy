DROP POLICY IF EXISTS documentos_delete ON public.documentos;

CREATE POLICY documentos_delete ON public.documentos
  FOR DELETE
  TO authenticated
  USING (
    is_master(auth.uid())
    OR has_permission(auth.uid(), 'documento.excluir'::text, unidade_id, secretaria_id)
    OR (created_by = auth.uid() AND deleted_at IS NULL)
  );

UPDATE public.documentos
SET deleted_at = now(),
    metadata = coalesce(metadata, '{}'::jsonb)
      || jsonb_build_object('binario_ausente', true, 'motivo_remocao', 'descarte_parcial_r2')
WHERE deleted_at IS NULL
  AND tipo_entidade = 'frequencia_submissao'
  AND entidade_id = '1f08da49-b785-4e4f-aa76-b044a3c97b1d'
  AND created_at >= '2026-08-31 12:12:00+00'
  AND created_at <= '2026-08-31 12:14:00+00';