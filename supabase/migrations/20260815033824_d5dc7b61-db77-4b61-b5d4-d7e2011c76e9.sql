-- Drop the existing policy that might be too restrictive or confusing
DROP POLICY IF EXISTS "assinaturas_insert" ON public.assinaturas_institucionais;
DROP POLICY IF EXISTS "assinaturas_insert_own" ON public.assinaturas_institucionais;

-- Re-create a robust INSERT policy for Master users
CREATE POLICY "assinaturas_insert_master" 
ON public.assinaturas_institucionais 
FOR INSERT 
TO authenticated 
WITH CHECK (public.is_master(auth.uid()));

-- Re-create a robust INSERT policy for institutional management permissions
CREATE POLICY "assinaturas_insert_institutional" 
ON public.assinaturas_institucionais 
FOR INSERT 
TO authenticated 
WITH CHECK (public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id));

-- Re-create a robust INSERT policy for personal signatures
-- This policy specifically handles the 'is_pessoal = true' case for any eligible user
CREATE POLICY "assinaturas_insert_pessoal" 
ON public.assinaturas_institucionais 
FOR INSERT 
TO authenticated 
WITH CHECK (
  (is_pessoal = true) AND 
  (usuario_id = auth.uid()) AND 
  public.usuario_pode_cadastrar_assinatura(auth.uid()) AND 
  (
    (unidade_id IS NULL) OR 
    public.user_has_unit(auth.uid(), unidade_id)
  )
);

-- Ensure the 'assinaturas' bucket allows inserts for personal signatures as well
-- Check if the RLS for the bucket is correctly set for authenticated users to upload to their own path
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'objects' 
        AND schemaname = 'storage' 
        AND policyname = 'Allow users to upload personal signatures'
    ) THEN
        CREATE POLICY "Allow users to upload personal signatures"
        ON storage.objects FOR INSERT TO authenticated
        WITH CHECK (
            bucket_id = 'assinaturas' AND
            (storage.foldername(name))[1] = 'pessoal' AND
            (storage.foldername(name))[2] = auth.uid()::text
        );
    END IF;
END $$;
