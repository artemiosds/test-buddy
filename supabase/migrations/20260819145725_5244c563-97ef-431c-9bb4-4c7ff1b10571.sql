-- 1. Restaurar a função is_master para ser infalível, priorizando o código do perfil
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
      AND (
        p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER') 
        OR u.acesso_todas_unidades = true
      )
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

-- 3. Corrigir RLS de Unidades - MASTER deve ignorar qualquer filtro de usuário
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
CREATE POLICY "unidades_select" ON public.unidades
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = id)
    OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
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
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
    OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
  )
);

-- 5. Corrigir RLS de Frequências (Removendo a barreira que causava "Acesso administrativo restrito")
DROP POLICY IF EXISTS "frequencias_select_v2" ON public.frequencias;
CREATE POLICY "frequencias_select_v2" ON public.frequencias
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM competencia_unidades cu
      WHERE cu.id = frequencias.competencia_unidade_id
      AND public.user_has_unit(auth.uid(), cu.unidade_id)
    )
  )
);

-- 6. Garantir permissões de leitura para as tabelas de suporte nas RLS
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
