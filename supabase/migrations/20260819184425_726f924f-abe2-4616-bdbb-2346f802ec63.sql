-- DROP functions with potential type conflicts
DROP FUNCTION IF EXISTS public.get_my_user_context() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_unidades() CASCADE;
DROP FUNCTION IF EXISTS public.is_master(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.array_distinct(anyarray) CASCADE;

-- Helper distinct para arrays
CREATE OR REPLACE FUNCTION public.array_distinct(anyarray)
RETURNS anyarray AS $$
  SELECT ARRAY(SELECT DISTINCT unnest($1))
$$ LANGUAGE sql STABLE;

-- 1. Unificar Lógica de MASTER
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid DEFAULT auth.uid())
RETURNS boolean AS $$
DECLARE
    is_master_bool boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.perfis p ON p.id = u.perfil_id
        WHERE u.id = _user_id 
          AND u.deleted_at IS NULL
          AND (
            u.acesso_todas_unidades = true
            OR u.acesso_todas_secretarias = true
            OR p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'ADMIN_MASTER', 'SUPERMASTER', 'ADMIN_SMS')
          )
    ) INTO is_master_bool;
    
    RETURN is_master_bool;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Normalizar IDs de Unidade (Master vê tudo)
CREATE OR REPLACE FUNCTION public.current_user_unidades()
RETURNS uuid[] AS $$
DECLARE
    is_master_val boolean;
    unidade_principal uuid;
    unidades_vinculadas uuid[];
BEGIN
    is_master_val := public.is_master(auth.uid());
    
    -- Se master, retorna todas as unidades ativas
    IF is_master_val THEN
        RETURN ARRAY(SELECT id FROM public.unidades WHERE deleted_at IS NULL);
    END IF;

    -- Senão, pega os vínculos diretos
    SELECT unidade_principal_id INTO unidade_principal FROM public.usuarios WHERE id = auth.uid();
    
    SELECT ARRAY_AGG(unidade_id) INTO unidades_vinculadas
    FROM public.usuario_unidade_vinculos
    WHERE usuario_id = auth.uid();

    RETURN public.array_distinct(
        ARRAY_REMOVE(
            ARRAY_APPEND(COALESCE(unidades_vinculadas, ARRAY[]::uuid[]), unidade_principal),
            NULL
        )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Nova RPC get_my_user_context centralizada
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
        'unidades', public.current_user_unidades(),
        'cpf', u.cpf,
        'matricula', u.matricula,
        'unidade_principal_id', u.unidade_principal_id
    ) INTO result
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = auth.uid()
      AND u.deleted_at IS NULL;
      
    RETURN result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. GRANTS
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_unidades() TO authenticated;
