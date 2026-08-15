
-- 1. Identifica e remove políticas de delete duplicadas ou conflitantes
DROP POLICY IF EXISTS "assinaturas_delete" ON public.assinaturas_institucionais;
DROP POLICY IF EXISTS "assinaturas_delete_own" ON public.assinaturas_institucionais;

-- 2. Cria uma política unificada que permite delete para Master OU para o próprio dono se for pessoal
CREATE POLICY "assinaturas_delete_unified" ON public.assinaturas_institucionais
FOR DELETE TO authenticated
USING (
  public.is_master(auth.uid()) 
  OR 
  (usuario_id = auth.uid() AND is_pessoal = true)
);

-- 3. Adiciona permissão explícita para o perfil MASTER na política de inserção institucional
-- A política antiga 'assinaturas_insert' usava has_permission, mas has_permission às vezes falha 
-- se o usuário for MASTER mas não tiver o registro de permissão explícito na tabela de permissões.
DROP POLICY IF EXISTS "assinaturas_insert" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_insert" ON public.assinaturas_institucionais 
FOR INSERT TO authenticated 
WITH CHECK (
  public.is_master(auth.uid())
  OR 
  public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id)
);

-- 4. Garante que MASTER também pode dar UPDATE em qualquer uma
DROP POLICY IF EXISTS "assinaturas_update" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_update" ON public.assinaturas_institucionais
FOR UPDATE TO authenticated
USING (
  public.is_master(auth.uid())
  OR
  public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id)
)
WITH CHECK (
  public.is_master(auth.uid())
  OR
  public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id)
);
