-- 1. Garante permissão de UPDATE e DELETE no bucket de assinaturas para usuários MASTER
-- O erro 403 Forbidden no Storage geralmente ocorre por falta de política RLS ou permissão direta.

DO $$ 
BEGIN
    -- Permitir que MASTER delete qualquer objeto no bucket 'assinaturas'
    -- (Desde que não esteja bloqueado pela função de integridade histórica)
    DROP POLICY IF EXISTS "Master can delete any signature" ON storage.objects;
    CREATE POLICY "Master can delete any signature"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'assinaturas' AND 
      public.is_master(auth.uid())
    );

    -- Permitir que MASTER atualize qualquer objeto no bucket 'assinaturas'
    DROP POLICY IF EXISTS "Master can update any signature" ON storage.objects;
    CREATE POLICY "Master can update any signature"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'assinaturas' AND 
      public.is_master(auth.uid())
    );

    -- 2. Reforça as permissões DML na tabela de assinaturas institucionais
    -- para garantir que o perfil MASTER não seja barrado por políticas residuais.
    DROP POLICY IF EXISTS "assinaturas_update_master_pessoal" ON public.assinaturas_institucionais;
    CREATE POLICY "assinaturas_update_master_pessoal"
    ON public.assinaturas_institucionais
    FOR UPDATE
    TO authenticated
    USING (
      public.is_master(auth.uid()) OR 
      ((usuario_id = auth.uid()) AND (is_pessoal = true))
    )
    WITH CHECK (
      public.is_master(auth.uid()) OR 
      ((usuario_id = auth.uid()) AND (is_pessoal = true))
    );

    DROP POLICY IF EXISTS "assinaturas_delete_master_pessoal" ON public.assinaturas_institucionais;
    CREATE POLICY "assinaturas_delete_master_pessoal"
    ON public.assinaturas_institucionais
    FOR DELETE
    TO authenticated
    USING (
      public.is_master(auth.uid()) OR 
      ((usuario_id = auth.uid()) AND (is_pessoal = true))
    );

END $$;
