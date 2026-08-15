-- Adiciona permissão de UPDATE para MASTER e para o próprio usuário (assinaturas pessoais)
-- O erro 403 (Forbidden) no PATCH indica que a política de UPDATE está bloqueando.

DROP POLICY IF EXISTS "assinaturas_update" ON public.assinaturas_institucionais;
DROP POLICY IF EXISTS "assinaturas_update_own" ON public.assinaturas_institucionais;

-- Política unificada de UPDATE (Master pode tudo, usuário pode a sua pessoal)
CREATE POLICY "assinaturas_update_unified"
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

-- Reforço das permissões para garantir que MASTER possa gerenciar tudo
-- e que o titular possa gerenciar sua própria assinatura pessoal
GRANT UPDATE ON public.assinaturas_institucionais TO authenticated;
