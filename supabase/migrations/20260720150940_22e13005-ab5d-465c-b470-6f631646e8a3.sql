
-- Policies para o bucket 'avatars': leitura pública, upload/gestão por autenticados.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_public_read') THEN
    CREATE POLICY "avatars_public_read" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_auth_insert') THEN
    CREATE POLICY "avatars_auth_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_auth_update') THEN
    CREATE POLICY "avatars_auth_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (bucket_id = 'avatars')
      WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars_auth_delete') THEN
    CREATE POLICY "avatars_auth_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'avatars');
  END IF;
END$$;
