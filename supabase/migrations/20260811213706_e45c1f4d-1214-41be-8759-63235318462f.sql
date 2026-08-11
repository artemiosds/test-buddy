DO $$
DECLARE
    _user_id uuid;
    _perfil_master_id uuid;
BEGIN
    SELECT id INTO _user_id FROM auth.users WHERE email = 'artemiosouza99@gmail.com';
    SELECT id INTO _perfil_master_id FROM public.perfis WHERE codigo = 'MASTER';

    IF _user_id IS NOT NULL AND _perfil_master_id IS NOT NULL THEN
        UPDATE public.usuarios 
        SET 
            perfil_id = _perfil_master_id,
            acesso_todas_unidades = true,
            acesso_todas_secretarias = true,
            status = 'ativo',
            deleted_at = null
        WHERE id = _user_id;
    END IF;

    UPDATE public.sistema_config 
    SET 
        modo_manutencao_ativo = false,
        aviso_manutencao_id = null
    WHERE modo_manutencao_ativo = true;
END $$;