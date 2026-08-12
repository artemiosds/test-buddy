DROP POLICY IF EXISTS assinaturas_insert ON storage.objects;
DROP POLICY IF EXISTS assinaturas_update ON storage.objects;
DROP POLICY IF EXISTS assinaturas_read ON storage.objects;

CREATE POLICY assinaturas_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assinaturas'
  AND (
    (
      split_part(name, '/', 1) = 'pessoal'
      AND split_part(name, '/', 2) = auth.uid()::text
      AND split_part(name, '/', 3) <> ''
    )
    OR
    (
      split_part(name, '/', 1) = 'institucional'
      AND split_part(name, '/', 2) = auth.uid()::text
      AND split_part(name, '/', 3) <> ''
      AND public.has_permission(auth.uid(), 'assinatura.gerenciar', NULL, NULL)
    )
  )
);

CREATE POLICY assinaturas_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (
    (
      split_part(name, '/', 1) = 'pessoal'
      AND split_part(name, '/', 2) = auth.uid()::text
      AND split_part(name, '/', 3) <> ''
    )
    OR
    (
      split_part(name, '/', 1) = 'institucional'
      AND split_part(name, '/', 3) <> ''
      AND public.has_permission(auth.uid(), 'assinatura.gerenciar', NULL, NULL)
    )
  )
)
WITH CHECK (
  bucket_id = 'assinaturas'
  AND (
    (
      split_part(name, '/', 1) = 'pessoal'
      AND split_part(name, '/', 2) = auth.uid()::text
      AND split_part(name, '/', 3) <> ''
    )
    OR
    (
      split_part(name, '/', 1) = 'institucional'
      AND split_part(name, '/', 3) <> ''
      AND public.has_permission(auth.uid(), 'assinatura.gerenciar', NULL, NULL)
    )
  )
);

CREATE POLICY assinaturas_read
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'assinaturas'
  AND (
    public.is_master(auth.uid())
    OR (
      split_part(name, '/', 1) = 'pessoal'
      AND split_part(name, '/', 2) = auth.uid()::text
    )
    OR split_part(name, '/', 1) = 'institucional'
  )
);