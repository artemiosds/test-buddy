-- 1. Unificar e simplificar a política de DELETE para ser permissiva ao MASTER e ao dono
DROP POLICY IF EXISTS "assinaturas_delete_master_pessoal" ON public.assinaturas_institucionais;

CREATE POLICY "assinaturas_delete_unified" 
ON public.assinaturas_institucionais 
FOR UPDATE -- Lembre-se: o frontend faz UPDATE para setar deleted_at
TO authenticated
USING (
  public.is_master(auth.uid()) OR 
  usuario_id = auth.uid()
)
WITH CHECK (
  public.is_master(auth.uid()) OR 
  usuario_id = auth.uid()
);

-- Para o caso de chamadas DELETE reais (como no meu-perfil.assinatura.tsx)
CREATE POLICY "assinaturas_real_delete_unified" 
ON public.assinaturas_institucionais 
FOR DELETE 
TO authenticated
USING (
  public.is_master(auth.uid()) OR 
  usuario_id = auth.uid()
);

-- 2. Corrigir políticas de Storage para o bucket 'assinaturas'
-- O erro 403 muitas vezes vem do Storage quando a tabela RLS passa mas o arquivo não.
DROP POLICY IF EXISTS "Master can delete any signature" ON storage.objects;
DROP POLICY IF EXISTS "assinaturas_delete" ON storage.objects;
DROP POLICY IF EXISTS "Proteção de assinaturas em uso" ON storage.objects;

-- Política de DELETE no Storage: Master deleta tudo, Usuário deleta o que é dele,
-- DESDE QUE não esteja em uso histórico (assinatura_em_uso).
CREATE POLICY "assinaturas_storage_delete_unified"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assinaturas' AND 
  (public.is_master(auth.uid()) OR (storage.foldername(name))[2] = auth.uid()::text) AND
  NOT public.assinatura_em_uso(name)
);

-- Garantir que UPDATE também seja possível (embora raro no bucket de assinaturas)
DROP POLICY IF EXISTS "Master can update any signature" ON storage.objects;
DROP POLICY IF EXISTS "assinaturas_update" ON storage.objects;

CREATE POLICY "assinaturas_storage_update_unified"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'assinaturas' AND 
  (public.is_master(auth.uid()) OR (storage.foldername(name))[2] = auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'assinaturas' AND 
  (public.is_master(auth.uid()) OR (storage.foldername(name))[2] = auth.uid()::text)
);
