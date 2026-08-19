-- 1. Restaurar a função is_master para ser infalível
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id 
      AND (p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'GESTOR') OR u.acesso_todas_unidades = true)
      AND u.deleted_at IS NULL
  );
$$;

-- 2. Reforçar a função user_has_unit (Corrigindo a tabela para usuario_unidades)
CREATE OR REPLACE FUNCTION public.user_has_unit(_user_id uuid, _unidade_id uuid)
RETURNS boolean 
LANGUAGE sql 
STABLE 
SECURITY DEFINER 
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuario_unidades
    WHERE usuario_id = _user_id AND unidade_id = _unidade_id
  ) OR public.is_master(_user_id);
$$;

-- 3. Corrigir RLS de Unidades para garantir que Master veja TUDO
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
CREATE POLICY "unidades_select" ON public.unidades
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_master(auth.uid()) -- Master vê tudo
    OR EXISTS (SELECT 1 FROM public.usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = id)
  )
);

-- 4. Corrigir RLS de Profissionais
DROP POLICY IF EXISTS "profissionais_select" ON public.profissionais;
CREATE POLICY "profissionais_select" ON public.profissionais
FOR SELECT 
TO authenticated
USING (
  deleted_at IS NULL 
  AND (
    public.is_master(auth.uid()) -- Master vê tudo
    OR public.user_has_unit(auth.uid(), unidade_id)
  )
);

-- 5. Corrigir RLS de Frequências (A raiz do problema de "Acesso Restrito")
DROP POLICY IF EXISTS "frequencias_select_v2" ON public.frequencias;
CREATE POLICY "frequencias_select_v2" ON public.frequencias
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_master(auth.uid()) -- Master vê tudo sem restrição
    OR EXISTS (
      SELECT 1 FROM competencia_unidades cu
      WHERE cu.id = frequencias.competencia_unidade_id
      AND public.user_has_unit(auth.uid(), cu.unidade_id)
    )
  )
);

-- 6. Garantir que a tabela de vinculação é acessível para os checks
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
