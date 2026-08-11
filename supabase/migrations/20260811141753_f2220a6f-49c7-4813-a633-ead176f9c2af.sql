-- 1. Assegurar permissões de execução para as funções RBAC
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_db(uuid) TO authenticated, anon, service_role;

-- 2. Testes de Validação (FASE 10)
DO $$
DECLARE
    _master_id uuid;
    _user_id uuid;
    _perfil_id uuid;
    _perm_id uuid;
    _res boolean;
BEGIN
    -- Selecionar Master para Teste F
    SELECT u.id INTO _master_id 
    FROM public.usuarios u 
    JOIN public.perfis p ON u.perfil_id = p.id 
    WHERE p.codigo = 'MASTER' AND u.deleted_at IS NULL LIMIT 1;

    IF _master_id IS NOT NULL THEN
        _res := public.has_permission_core(_master_id, 'permissao.inexistente');
        IF _res != true THEN RAISE EXCEPTION 'TESTE F FALHOU: Master deve ter acesso total'; END IF;
    END IF;

    -- Teste de Ambiguidade (Causa Raiz)
    -- Se a função antiga (2 args) ainda existisse e fosse ambígua, este SELECT falharia
    EXECUTE 'SELECT public.has_permission_core($1, $2)' USING gen_random_uuid(), 'teste.ambiguidade' INTO _res;

    RAISE NOTICE 'RBAC: Validação SQL concluída sem erros de ambiguidade.';
END $$;