-- Corrigir a política de SELECT de profissionais para respeitar RLS de unidade
-- Atualmente está 'true' (universal para qualquer autenticado)
DROP POLICY IF EXISTS "profissionais_select_policy" ON public.profissionais;
CREATE POLICY "profissionais_select_policy" ON public.profissionais
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    unidade_id IN (SELECT get_minhas_unidades_ids())
    OR
    secretaria_id IN (SELECT secretaria_id FROM public.usuario_secretarias WHERE usuario_id = auth.uid() AND deleted_at IS NULL)
);

-- Garantir que a política de frequências use a função otimizada
DROP POLICY IF EXISTS "frequencias_select_policy" ON public.frequencias;
CREATE POLICY "frequencias_select_policy" ON public.frequencias
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    EXISTS (
        SELECT 1 FROM public.competencia_unidades cu
        WHERE cu.id = frequencias.competencia_unidade_id
        AND cu.unidade_id IN (SELECT get_minhas_unidades_ids())
    )
);

-- Garantir que a política de competencia_unidades use a função otimizada
DROP POLICY IF EXISTS "comp_unid_select" ON public.competencia_unidades;
CREATE POLICY "comp_unid_select" ON public.competencia_unidades
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    unidade_id IN (SELECT get_minhas_unidades_ids())
);

-- Criar/Atualizar política para setores
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "setores_select_policy" ON public.setores;
CREATE POLICY "setores_select_policy" ON public.setores
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    unidade_id IN (SELECT get_minhas_unidades_ids())
);