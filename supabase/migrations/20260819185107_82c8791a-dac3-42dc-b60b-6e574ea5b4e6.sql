-- Corrigindo a RPC get_my_user_context para remover campos inexistentes (cpf, matricula, unidade_principal_id)
-- E garantir que a função current_user_unidades use a tabela correta (usuario_unidades)

-- 1. Recriar current_user_unidades com a tabela correta
CREATE OR REPLACE FUNCTION public.current_user_unidades()
RETURNS uuid[] AS $$
DECLARE
    is_master_val boolean;
    unidades_vinculadas uuid[];
BEGIN
    is_master_val := public.is_master(auth.uid());
    
    -- Se master, retorna todas as unidades ativas
    IF is_master_val THEN
        RETURN ARRAY(SELECT id FROM public.unidades WHERE deleted_at IS NULL);
    END IF;

    -- Senão, pega os vínculos na tabela usuario_unidades
    SELECT ARRAY_AGG(unidade_id) INTO unidades_vinculadas
    FROM public.usuario_unidades
    WHERE usuario_id = auth.uid();

    RETURN public.array_distinct(COALESCE(unidades_vinculadas, ARRAY[]::uuid[]));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Recriar get_my_user_context removendo campos inexistentes na tabela public.usuarios
CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
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
        'is_master', public.is_master(u.id),
        'perfil_admin_2fa_required', COALESCE(p.admin_2fa_required, false),
        'unidades', public.current_user_unidades()
    ) INTO result
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.deleted_at IS NULL;
      
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
