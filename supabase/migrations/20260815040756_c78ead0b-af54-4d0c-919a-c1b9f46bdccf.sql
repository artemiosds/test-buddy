-- Correção definitiva das políticas RLS para permitir que MASTER atualize e exclua registros
-- O erro 403 Forbidden no PATCH indica que a política de UPDATE estava bloqueando a ação.

-- 1. Unificar e simplificar a política de UPDATE
DROP POLICY IF EXISTS "assinaturas_update" ON public.assinaturas_institucionais;
DROP POLICY IF EXISTS "assinaturas_update_own" ON public.assinaturas_institucionais;
DROP POLICY IF EXISTS "assinaturas_update_unified" ON public.assinaturas_institucionais;

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

-- 2. Garantir que a política de DELETE também seja robusta para MASTER
DROP POLICY IF EXISTS "assinaturas_delete_unified" ON public.assinaturas_institucionais;

CREATE POLICY "assinaturas_delete_master_pessoal"
ON public.assinaturas_institucionais
FOR DELETE
TO authenticated
USING (
  public.is_master(auth.uid()) OR 
  ((usuario_id = auth.uid()) AND (is_pessoal = true))
);

-- 3. Garantir permissões de banco explícitas (DML)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas_institucionais TO authenticated;
GRANT ALL ON public.assinaturas_institucionais TO service_role;
