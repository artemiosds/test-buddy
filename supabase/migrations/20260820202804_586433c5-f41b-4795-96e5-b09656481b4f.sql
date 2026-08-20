-- Unificação e Reforço das Políticas de RLS com Sistema de Permissões Hierárquico

-- 1. Garantir que is_master, has_permission e helpers estejam corretos
-- (Assumindo que as funções já existem conforme auditoria, apenas reforçando permissões)
GRANT EXECUTE ON FUNCTION public.has_permission(UUID, TEXT, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(UUID) TO authenticated;

-- 2. Tabela: profissionais
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profissionais_select_policy" ON public.profissionais;
CREATE POLICY "profissionais_select_policy" ON public.profissionais
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'profissional.visualizar', unidade_id, secretaria_id)
    );

DROP POLICY IF EXISTS "profissionais_insert_policy" ON public.profissionais;
CREATE POLICY "profissionais_insert_policy" ON public.profissionais
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'profissional.criar', unidade_id, secretaria_id)
    );

DROP POLICY IF EXISTS "profissionais_update_policy" ON public.profissionais;
CREATE POLICY "profissionais_update_policy" ON public.profissionais
    FOR UPDATE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id)
    )
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id)
    );

DROP POLICY IF EXISTS "profissionais_delete_policy" ON public.profissionais;
CREATE POLICY "profissionais_delete_policy" ON public.profissionais
    FOR DELETE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'profissional.excluir', unidade_id, secretaria_id)
    );

-- 3. Tabela: competencias
ALTER TABLE public.competencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competencias_select_policy" ON public.competencias;
CREATE POLICY "competencias_select_policy" ON public.competencias
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.visualizar', NULL, secretaria_id)
    );

DROP POLICY IF EXISTS "competencias_insert" ON public.competencias;
CREATE POLICY "competencias_insert" ON public.competencias
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.criar', NULL, secretaria_id)
    );

DROP POLICY IF EXISTS "competencias_update" ON public.competencias;
CREATE POLICY "competencias_update" ON public.competencias
    FOR UPDATE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.editar', NULL, secretaria_id)
    )
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.editar', NULL, secretaria_id)
    );

-- 4. Tabela: competencia_unidades
ALTER TABLE public.competencia_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comp_unid_select" ON public.competencia_unidades;
CREATE POLICY "comp_unid_select" ON public.competencia_unidades
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.visualizar', unidade_id, NULL)
    );

DROP POLICY IF EXISTS "comp_unid_insert" ON public.competencia_unidades;
CREATE POLICY "comp_unid_insert" ON public.competencia_unidades
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.criar', unidade_id, NULL)
    );

DROP POLICY IF EXISTS "comp_unid_update" ON public.competencia_unidades;
CREATE POLICY "comp_unid_update" ON public.competencia_unidades
    FOR UPDATE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.editar', unidade_id, NULL)
        OR public.has_permission(auth.uid(), 'frequencia.editar', unidade_id, NULL)
    )
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR public.has_permission(auth.uid(), 'competencia.editar', unidade_id, NULL)
        OR public.has_permission(auth.uid(), 'frequencia.editar', unidade_id, NULL)
    );

-- 5. Tabela: frequencias
ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frequencias_select_policy" ON public.frequencias;
CREATE POLICY "frequencias_select_policy" ON public.frequencias
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.competencia_unidades cu 
            WHERE cu.id = frequencias.competencia_unidade_id 
            AND public.has_permission(auth.uid(), 'frequencia.visualizar', cu.unidade_id, NULL)
        )
    );

DROP POLICY IF EXISTS "frequencias_insert" ON public.frequencias;
CREATE POLICY "frequencias_insert" ON public.frequencias
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.competencia_unidades cu 
            WHERE cu.id = competencia_unidade_id 
            AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)
        )
    );

DROP POLICY IF EXISTS "frequencias_update" ON public.frequencias;
CREATE POLICY "frequencias_update" ON public.frequencias
    FOR UPDATE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.competencia_unidades cu 
            WHERE cu.id = competencia_unidade_id 
            AND (
                public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL) 
                OR public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL)
            )
        )
    )
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.competencia_unidades cu 
            WHERE cu.id = competencia_unidade_id 
            AND (
                public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL) 
                OR public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL)
            )
        )
    );

-- 6. Tabela: frequencia_profissional
ALTER TABLE public.frequencia_profissional ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas excessivamente permissivas identificadas na auditoria
DROP POLICY IF EXISTS "Permitir leitura de frequencia_profissional" ON public.frequencia_profissional;
DROP POLICY IF EXISTS "Permitir inserção de frequencia_profissional" ON public.frequencia_profissional;
DROP POLICY IF EXISTS "frequencia_profissional_select" ON public.frequencia_profissional;

CREATE POLICY "frequencia_profissional_select" ON public.frequencia_profissional
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_profissional.frequencia_id
            AND public.has_permission(auth.uid(), 'frequencia.visualizar', cu.unidade_id, NULL)
        )
    );

CREATE POLICY "frequencia_profissional_insert" ON public.frequencia_profissional
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_id
            AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)
        )
    );

CREATE POLICY "frequencia_profissional_update" ON public.frequencia_profissional
    FOR UPDATE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_profissional.frequencia_id
            AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)
        )
    )
    WITH CHECK (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_profissional.frequencia_id
            AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)
        )
    );

CREATE POLICY "frequencia_profissional_delete" ON public.frequencia_profissional
    FOR DELETE TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_profissional.frequencia_id
            AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)
        )
    );
