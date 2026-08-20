
-- CRIAR POLÍTICAS DE SELECT FALTANTES
-- Unidades
DROP POLICY IF EXISTS "unidades_select_policy" ON public.unidades;
CREATE POLICY "unidades_select_policy" ON public.unidades
FOR SELECT TO authenticated
USING (
    is_master(auth.uid()) 
    OR (id IN (SELECT unidade_id FROM public.usuario_unidades WHERE usuario_id = auth.uid() AND deleted_at IS NULL))
    OR (status = 'ativa')
);

-- Competências (Leitura pública para autenticados é segura, controle é no write)
DROP POLICY IF EXISTS "competencias_select_policy" ON public.competencias;
CREATE POLICY "competencias_select_policy" ON public.competencias
FOR SELECT TO authenticated
USING (deleted_at IS NULL);

-- Setores
DROP POLICY IF EXISTS "setores_select_policy" ON public.setores;
CREATE POLICY "setores_select_policy" ON public.setores
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR (unidade_id IN (SELECT unidade_id FROM public.usuario_unidades WHERE usuario_id = auth.uid() AND deleted_at IS NULL))
);

-- Competência Unidades
DROP POLICY IF EXISTS "comp_unid_select" ON public.competencia_unidades;
CREATE POLICY "comp_unid_select" ON public.competencia_unidades
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR (unidade_id IN (SELECT unidade_id FROM public.usuario_unidades WHERE usuario_id = auth.uid() AND deleted_at IS NULL))
);

-- Frequências
DROP POLICY IF EXISTS "frequencias_select_policy" ON public.frequencias;
CREATE POLICY "frequencias_select_policy" ON public.frequencias
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR (EXISTS (
        SELECT 1 FROM public.competencia_unidades cu
        WHERE cu.id = competencia_unidade_id
        AND (cu.unidade_id IN (SELECT unidade_id FROM public.usuario_unidades WHERE usuario_id = auth.uid() AND deleted_at IS NULL))
    ))
);

-- Garantir GRANTs
GRANT SELECT ON public.unidades TO authenticated;
GRANT SELECT ON public.competencias TO authenticated;
GRANT SELECT ON public.setores TO authenticated;
GRANT SELECT ON public.profissionais TO authenticated;
GRANT SELECT ON public.frequencias TO authenticated;
GRANT SELECT ON public.competencia_unidades TO authenticated;
