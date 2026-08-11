
-- Auditoria de permissões e restauração de acesso MASTER
-- Identificando o usuário afetado (artemiosouza99@gmail.com)
DO $$
DECLARE
    _user_id uuid;
    _perfil_master_id uuid;
BEGIN
    -- 1. Buscar o ID do usuário e do perfil MASTER
    SELECT id INTO _user_id FROM auth.users WHERE email = 'artemiosouza99@gmail.com';
    SELECT id INTO _perfil_master_id FROM public.perfis WHERE codigo = 'MASTER';

    IF _user_id IS NOT NULL AND _perfil_master_id IS NOT NULL THEN
        -- 2. Restaurar as flags de acesso global no perfil do usuário
        UPDATE public.usuarios 
        SET 
            perfil_id = _perfil_master_id,
            acesso_todas_unidades = true,
            acesso_todas_secretarias = true,
            status = 'ativo',
            deleted_at = null
        WHERE id = _user_id;
        
        RAISE NOTICE 'Usuário % restaurado para MASTER com acesso global.', _user_id;
    ELSE
        RAISE EXCEPTION 'Usuário ou Perfil MASTER não encontrado.';
    END IF;

    -- 3. Desativar modo de manutenção global se estiver ativo por engano
    UPDATE public.sistema_config 
    SET 
        modo_manutencao_ativo = false,
        aviso_manutencao_id = null
    WHERE modo_manutencao_ativo = true;

END $$;
