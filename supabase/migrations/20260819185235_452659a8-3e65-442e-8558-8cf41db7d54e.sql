-- Garantir que a RPC retorne dados básicos mesmo se houver erro nas funções de apoio
CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    unidades_ids uuid[];
    is_master_bool boolean;
BEGIN
    -- Cálculo seguro de is_master
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.perfis p ON p.id = u.perfil_id
        WHERE u.id = auth.uid() 
          AND u.deleted_at IS NULL
          AND (
            u.acesso_todas_unidades = true
            OR u.acesso_todas_secretarias = true
            OR p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'ADMIN_MASTER', 'SUPERMASTER', 'ADMIN_SMS')
          )
    ) INTO is_master_bool;

    -- Cálculo seguro de unidades
    IF is_master_bool THEN
        SELECT ARRAY(SELECT id FROM public.unidades WHERE deleted_at IS NULL) INTO unidades_ids;
    ELSE
        SELECT ARRAY_AGG(unidade_id) INTO unidades_ids
        FROM public.usuario_unidades
        WHERE usuario_id = auth.uid();
    END IF;

    SELECT jsonb_build_object(
        'id', u.id,
        'nome_completo', u.nome_completo,
        'email', u.email,
        'status', u.status,
        'perfil_id', u.perfil_id,
        'perfil_codigo', p.codigo,
        'perfil_nome', p.nome,
        'secretaria_id', u.secretaria_id,
        'acesso_todas_unidades', u.acesso_todas_unidades,
        'acesso_todas_secretarias', u.acesso_todas_secretarias,
        'is_master', is_master_bool,
        'perfil_admin_2fa_required', COALESCE(p.admin_2fa_required, false),
        'unidades', COALESCE(unidades_ids, ARRAY[]::uuid[])
    ) INTO result
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.deleted_at IS NULL;
      
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
