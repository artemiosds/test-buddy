DROP POLICY IF EXISTS assinaturas_insert ON storage.objects;
DROP POLICY IF EXISTS assinaturas_update ON storage.objects;

CREATE POLICY assinaturas_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'assinaturas' AND 
    (
        -- Novo formato: pessoal/{usuario_id}/{unidade_id}/{arquivo}
        (
            split_part(name, '/', 1) = 'pessoal' AND
            has_permission(
                auth.uid(), 
                'assinatura.gerenciar', 
                (NULLIF(split_part(name, '/', 3), ''))::uuid,
                (NULLIF(split_part(name, '/', 2), ''))::uuid
            )
        )
        OR
        -- Legado/Institucional: {unidade_id}/{usuario_id}/{arquivo}
        (
            split_part(name, '/', 1) <> 'pessoal' AND
            has_permission(
                auth.uid(), 
                'assinatura.gerenciar', 
                (NULLIF(split_part(name, '/', 2), ''))::uuid,
                (NULLIF(split_part(name, '/', 1), ''))::uuid
            )
        )
    )
);

CREATE POLICY assinaturas_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'assinaturas' AND 
    (
        (
            split_part(name, '/', 1) = 'pessoal' AND
            has_permission(
                auth.uid(), 
                'assinatura.gerenciar', 
                (NULLIF(split_part(name, '/', 3), ''))::uuid, 
                (NULLIF(split_part(name, '/', 2), ''))::uuid
            )
        )
        OR
        (
            split_part(name, '/', 1) <> 'pessoal' AND
            has_permission(
                auth.uid(), 
                'assinatura.gerenciar', 
                (NULLIF(split_part(name, '/', 2), ''))::uuid,
                (NULLIF(split_part(name, '/', 1), ''))::uuid
            )
        )
    )
);