-- Habilitar RLS em tabelas que podem estar desprotegidas
ALTER TABLE public.profissional_historico_funcional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piso_enfermagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vinculos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;

-- 1. Políticas de SELECT para PROFISSIONAIS e UNIDADES (Base)
-- Estas já devem existir, mas garantimos o bypass Master e a lógica de permissão.
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "profissionais_select_policy" ON public.profissionais;
    DROP POLICY IF EXISTS "unidades_select_policy" ON public.unidades;
END $$;

CREATE POLICY "profissionais_select_policy" ON public.profissionais FOR SELECT TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    public.has_permission(auth.uid(), 'profissional.visualizar', unidade_id, secretaria_id)
);

CREATE POLICY "unidades_select_policy" ON public.unidades FOR SELECT TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    (id IN (SELECT public.get_minhas_unidades_ids()))
);

-- 2. Políticas de SELECT para Tabelas Secundárias (dados_bancarios, histórico, etc)
-- Histórico Funcional
DO $$ BEGIN DROP POLICY IF EXISTS "profissional_historico_select" ON public.profissional_historico_funcional; END $$;
CREATE POLICY "profissional_historico_select" ON public.profissional_historico_funcional FOR SELECT TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.id = profissional_historico_funcional.profissional_id 
        AND public.has_permission(auth.uid(), 'profissional.visualizar', p.unidade_id, p.secretaria_id)
    )
);

-- Piso / Dados Salariais (Mapeado por CPF)
DO $$ BEGIN DROP POLICY IF EXISTS "piso_enfermagem_select" ON public.piso_enfermagem; END $$;
CREATE POLICY "piso_enfermagem_select" ON public.piso_enfermagem FOR SELECT TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.cpf = piso_enfermagem.cpf 
        AND public.has_permission(auth.uid(), 'profissional.visualizar', p.unidade_id, p.secretaria_id)
    )
);

-- 3. Políticas de SELECT para Tabelas de Lookup (Cargos, Funções, Vínculos, Setores)
-- Estas tabelas precisam ser visíveis para quem tem acesso à unidade ou secretaria relacionada.
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "cargos_select_policy" ON public.cargos;
    DROP POLICY IF EXISTS "funcoes_select_policy" ON public.funcoes;
    DROP POLICY IF EXISTS "vinculos_select_policy" ON public.vinculos;
    DROP POLICY IF EXISTS "setores_select_policy" ON public.setores;
END $$;

CREATE POLICY "cargos_select_policy" ON public.cargos FOR SELECT TO authenticated USING (true);
CREATE POLICY "funcoes_select_policy" ON public.funcoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "vinculos_select_policy" ON public.vinculos FOR SELECT TO authenticated USING (true);

CREATE POLICY "setores_select_policy" ON public.setores FOR SELECT TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    (unidade_id IN (SELECT public.get_minhas_unidades_ids()))
);

-- 4. Permissões de Escrita (INSERT/UPDATE) para Diretor nas tabelas relacionadas
DO $$ BEGIN DROP POLICY IF EXISTS "profissional_historico_write" ON public.profissional_historico_funcional; END $$;
CREATE POLICY "profissional_historico_write" ON public.profissional_historico_funcional FOR ALL TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.id = profissional_historico_funcional.profissional_id 
        AND public.has_permission(auth.uid(), 'profissional.editar', p.unidade_id, p.secretaria_id)
    )
)
WITH CHECK (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.id = profissional_historico_funcional.profissional_id 
        AND public.has_permission(auth.uid(), 'profissional.editar', p.unidade_id, p.secretaria_id)
    )
);

DO $$ BEGIN DROP POLICY IF EXISTS "piso_enfermagem_write" ON public.piso_enfermagem; END $$;
CREATE POLICY "piso_enfermagem_write" ON public.piso_enfermagem FOR ALL TO authenticated
USING (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.cpf = piso_enfermagem.cpf 
        AND public.has_permission(auth.uid(), 'profissional.editar', p.unidade_id, p.secretaria_id)
    )
)
WITH CHECK (
    public.is_master(auth.uid()) OR 
    EXISTS (
        SELECT 1 FROM public.profissionais p 
        WHERE p.cpf = piso_enfermagem.cpf 
        AND public.has_permission(auth.uid(), 'profissional.editar', p.unidade_id, p.secretaria_id)
    )
);

-- 5. Garantir Grants essenciais
GRANT SELECT ON public.cargos TO authenticated;
GRANT SELECT ON public.funcoes TO authenticated;
GRANT SELECT ON public.vinculos TO authenticated;
GRANT SELECT ON public.setores TO authenticated;
GRANT ALL ON public.profissional_historico_funcional TO authenticated;
GRANT ALL ON public.piso_enfermagem TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.usuario_unidades TO authenticated;
