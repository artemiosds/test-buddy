-- Resolve divergence: add 'devolvida' to status_frequencia enum
ALTER TYPE public.status_frequencia ADD VALUE IF NOT EXISTS 'devolvida' AFTER 'com_pendencias';

-- Ensure all tables have deleted_at if policies use it, 
-- or fix policies if they use deleted_at on tables that shouldn't have it.
-- Based on the previous check, tables like 'perfis', 'permissoes', ' fundos', 'cargos', 'funcoes', 'vinculos', 'calendario_institucional' might missing it if psql failed to find it.
-- However, my read_query showed it exists in 'frequencias', 'frequencia_profissional', etc.
-- Let's check 'perfil_permissoes' and 'perfil_permissoes_unidade' specifically.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='perfil_permissoes' AND column_name='deleted_at') THEN
        ALTER TABLE public.perfil_permissoes ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='perfil_permissoes_unidade' AND column_name='deleted_at') THEN
        ALTER TABLE public.perfil_permissoes_unidade ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Grant permissions (standard procedure)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia_profissional TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia_historico TO authenticated;
GRANT ALL ON public.frequencias TO service_role;
GRANT ALL ON public.frequencia_profissional TO service_role;
GRANT ALL ON public.frequencia_historico TO service_role;
