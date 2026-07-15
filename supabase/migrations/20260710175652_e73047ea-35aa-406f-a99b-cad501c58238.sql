-- ============ DOCUMENTOS ============
-- Path pattern: <secretaria_id>/<unidade_id>/<tipo>/<arquivo>
CREATE POLICY "documentos_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos' AND (
    public.is_master(auth.uid())
    OR public.user_has_secretaria(auth.uid(), (split_part(name, '/', 1))::uuid)
    OR public.user_has_unit(auth.uid(), NULLIF(split_part(name, '/', 2), '')::uuid)
  )
);

CREATE POLICY "documentos_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documentos' AND public.has_permission(
    auth.uid(), 'documento.upload',
    NULLIF(split_part(name, '/', 2), '')::uuid,
    (split_part(name, '/', 1))::uuid
  )
);

CREATE POLICY "documentos_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos' AND public.has_permission(
    auth.uid(), 'documento.upload',
    NULLIF(split_part(name, '/', 2), '')::uuid,
    (split_part(name, '/', 1))::uuid
  )
);

CREATE POLICY "documentos_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documentos' AND (
    public.is_master(auth.uid())
    OR public.has_permission(
      auth.uid(), 'documento.excluir',
      NULLIF(split_part(name, '/', 2), '')::uuid,
      (split_part(name, '/', 1))::uuid
    )
  )
);

-- ============ ASSINATURAS ============
-- Path pattern: <secretaria_id>/<unidade_id_ou_'_'>/<arquivo>
CREATE POLICY "assinaturas_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'assinaturas' AND (
    public.is_master(auth.uid())
    OR public.user_has_secretaria(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
);

CREATE POLICY "assinaturas_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assinaturas' AND public.has_permission(
    auth.uid(), 'assinatura.gerenciar',
    NULLIF(split_part(name, '/', 2), '')::uuid,
    (split_part(name, '/', 1))::uuid
  )
);

CREATE POLICY "assinaturas_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'assinaturas' AND public.has_permission(
    auth.uid(), 'assinatura.gerenciar',
    NULLIF(split_part(name, '/', 2), '')::uuid,
    (split_part(name, '/', 1))::uuid
  )
);

CREATE POLICY "assinaturas_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'assinaturas' AND public.is_master(auth.uid()));