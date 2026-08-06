
-- Removendo políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Autenticados veem avisos vigentes" ON public.avisos_mural;
DROP POLICY IF EXISTS "Gestores gerenciam avisos" ON public.avisos_mural;
DROP POLICY IF EXISTS "Todos podem ver avisos ativos" ON public.avisos_mural;
DROP POLICY IF EXISTS "Apenas master/gestor podem criar avisos" ON public.avisos_mural;
DROP POLICY IF EXISTS "Apenas master/gestor podem editar avisos" ON public.avisos_mural;
DROP POLICY IF EXISTS "Apenas master/gestor podem excluir avisos" ON public.avisos_mural;

-- Garantindo que RLS está habilitado
ALTER TABLE public.avisos_mural ENABLE ROW LEVEL SECURITY;

-- 1. Todos podem ver avisos ativos
CREATE POLICY "Todos podem ver avisos ativos"
ON public.avisos_mural FOR SELECT
TO authenticated
USING (true);

-- 2. Apenas master/gestor podem criar avisos
-- Baseado na estrutura: usuarios.id = auth.uid() e join com perfis.codigo
CREATE POLICY "Apenas master/gestor podem criar avisos"
ON public.avisos_mural FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.perfis p ON u.perfil_id = p.id
    WHERE u.id = auth.uid()
    AND p.codigo IN ('MASTER', 'GESTOR')
  )
);

-- 3. Apenas master/gestor podem editar avisos
CREATE POLICY "Apenas master/gestor podem editar avisos"
ON public.avisos_mural FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.perfis p ON u.perfil_id = p.id
    WHERE u.id = auth.uid()
    AND p.codigo IN ('MASTER', 'GESTOR')
  )
);

-- 4. Apenas master/gestor podem excluir avisos
CREATE POLICY "Apenas master/gestor podem excluir avisos"
ON public.avisos_mural FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.perfis p ON u.perfil_id = p.id
    WHERE u.id = auth.uid()
    AND p.codigo IN ('MASTER', 'GESTOR')
  )
);
