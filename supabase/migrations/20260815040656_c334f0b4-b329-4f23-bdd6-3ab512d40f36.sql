DROP POLICY IF EXISTS "assinaturas_delete_unified" ON public.assinaturas_institucionais;

-- Recriando a política de DELETE com bypass total para MASTER
CREATE POLICY "assinaturas_delete_unified"
ON public.assinaturas_institucionais
FOR DELETE
TO authenticated
USING (
  public.is_master(auth.uid()) OR 
  ((usuario_id = auth.uid()) AND (is_pessoal = true))
);

-- Garantindo permissão de DELETE no nível de banco
GRANT DELETE ON public.assinaturas_institucionais TO authenticated;