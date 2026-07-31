-- Fotos de profissionais: bucket privado, leitura só para autenticados,
-- escrita apenas para quem pode cadastrar/editar profissional.
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

CREATE POLICY "avatars_read_autenticado"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_permissao"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'profissional.criar', NULL, NULL)
    OR public.has_permission(auth.uid(), 'profissional.editar', NULL, NULL)
  )
);

CREATE POLICY "avatars_update_permissao"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'profissional.editar', NULL, NULL)
  )
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'profissional.editar', NULL, NULL)
  )
);

CREATE POLICY "avatars_delete_permissao"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'profissional.editar', NULL, NULL)
    OR public.has_permission(auth.uid(), 'profissional.excluir', NULL, NULL)
  )
);
