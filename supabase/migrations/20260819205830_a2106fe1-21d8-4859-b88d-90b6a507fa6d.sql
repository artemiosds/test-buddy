-- Teste de SELECT como usuário autenticado (simulado por service_role mas verificando Grants)
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.unidades TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;

-- Criar política de leitura para usuario_unidades se não houver uma simples
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'authenticated_read_own_vinculos') THEN
        CREATE POLICY "authenticated_read_own_vinculos" ON public.usuario_unidades
        FOR SELECT TO authenticated USING (usuario_id = auth.uid());
    END IF;
END $$;