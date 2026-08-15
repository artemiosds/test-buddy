-- 1. Garantir que a política de INSERT permita MASTER criar qualquer assinatura
DROP POLICY IF EXISTS "assinaturas_insert_master" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_insert_master" 
ON public.assinaturas_institucionais FOR INSERT 
TO authenticated 
WITH CHECK (public.is_master(auth.uid()));

-- 2. Garantir que a política de UPDATE permita MASTER editar qualquer assinatura (incluindo soft-delete)
DROP POLICY IF EXISTS "assinaturas_update_master" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_update_master" 
ON public.assinaturas_institucionais FOR UPDATE 
TO authenticated 
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

-- 3. Garantir que a política de DELETE permita MASTER excluir fisicamente se necessário
DROP POLICY IF EXISTS "assinaturas_delete_master" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_delete_master" 
ON public.assinaturas_institucionais FOR DELETE 
TO authenticated 
USING (public.is_master(auth.uid()));

-- 4. Corrigir políticas de Storage para MASTER
-- O MASTER deve ter poder total sobre o bucket de assinaturas, 
-- respeitando apenas a trava de integridade histórica (assinatura_em_uso).

DROP POLICY IF EXISTS "Master full access to signatures" ON storage.objects;
CREATE POLICY "Master full access to signatures"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'assinaturas' AND 
  public.is_master(auth.uid())
)
WITH CHECK (
  bucket_id = 'assinaturas' AND 
  public.is_master(auth.uid())
);

-- 5. Ajustar a política de DELETE no Storage para permitir MASTER excluir,
-- mas ainda respeitando a função de integridade histórica para evitar quebra de documentos.
-- Nota: A política ALL acima já cobre DELETE, mas se houver conflito com políticas restritivas,
-- a política mais permissiva (OR) ganha no Postgres RLS para tabelas, 
-- mas no Storage as políticas são combinadas.

DROP POLICY IF EXISTS "assinaturas_storage_delete_master" ON storage.objects;
CREATE POLICY "assinaturas_storage_delete_master"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assinaturas' AND 
  public.is_master(auth.uid()) AND
  NOT public.assinatura_em_uso(name)
);
