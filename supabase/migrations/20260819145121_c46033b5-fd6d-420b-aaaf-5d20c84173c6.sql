CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _user_id uuid;
    _perfil_codigo text;
    _unidades uuid[];
    _result jsonb;
BEGIN
    _user_id := auth.uid();
    
    IF _user_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Busca dados básicos e perfil
    SELECT 
        p.codigo INTO _perfil_codigo
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id;

    -- Busca unidades vinculadas (usando a tabela correta usuario_unidades)
    SELECT ARRAY_AGG(unidade_id) INTO _unidades
    FROM public.usuario_unidades
    WHERE usuario_id = _user_id;

    -- Monta o objeto final
    SELECT jsonb_build_object(
        'id', u.id,
        'nome_completo', u.nome_completo,
        'email', u.email,
        'status', u.status,
        'perfil_id', u.perfil_id,
        'perfil_codigo', p.codigo,
        'perfil_nome', p.nome,
        'secretaria_id', u.secretaria_id,
        'acesso_todas_unidades', COALESCE(u.acesso_todas_unidades, false),
        'acesso_todas_secretarias', COALESCE(u.acesso_todas_secretarias, false),
        'is_master', public.is_master(_user_id),
        'unidades', COALESCE(_unidades, '{}'::uuid[]),
        'cpf', u.cpf,
        'matricula', u.matricula
    ) INTO _result
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id;

    RETURN _result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
