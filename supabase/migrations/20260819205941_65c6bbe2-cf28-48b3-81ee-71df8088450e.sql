-- Garantir que as tabelas de suporte também tenham Grants
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.unidades TO authenticated;
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.usuario_secretarias TO authenticated;
GRANT SELECT ON public.secretarias TO authenticated;

-- Corrigir Grants de execução para funções críticas
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_minhas_unidades_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;

-- Verificar e garantir RLS na tabela de perfis (muitas vezes esquecida)
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'perfis_select_policy') THEN
        CREATE POLICY "perfis_select_policy" ON public.perfis
        FOR SELECT TO authenticated USING (true);
    END IF;
END $$;