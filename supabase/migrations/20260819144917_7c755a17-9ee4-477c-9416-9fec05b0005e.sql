
-- 1. Reforçar a função de verificação de unidade para ser resiliente (Corrigido para usuario_unidades)
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

-- 2. Atualizar a RLS de Profissionais
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

-- 3. Simplificar RLS de Frequências
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
    OR EXISTS (
      SELECT 1 FROM competencia_unidades cu
      JOIN unidades u ON u.id = cu.unidade_id
      WHERE cu.id = frequencias.competencia_unidade_id
      AND u.secretaria_id IS NOT NULL 
      AND public.user_has_secretaria(auth.uid(), u.secretaria_id)
    )
  )
);

-- 4. RLS de Unidades
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
CREATE POLICY "unidades_select" ON public.unidades
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), id)
    OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
  )
);

GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT ALL ON public.usuario_unidades TO service_role;
