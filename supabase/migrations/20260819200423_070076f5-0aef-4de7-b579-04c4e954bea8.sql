-- 1. Unificação da lógica MASTER em public.is_master
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            OR p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'ADMIN_SMS', 'ADMIN_MASTER', 'SUPERMASTER')
          )
    ) INTO is_master_bool;
    
    RETURN COALESCE(is_master_bool, false);
END;
$function$;

-- 2. Atualizar wrappers para usar is_master
CREATE OR REPLACE FUNCTION public.is_master_db(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_master(_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.is_master_core(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_master(_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.current_user_is_master()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_master(auth.uid());
$function$;

-- 3. Atualizar get_my_user_context para usar is_master
CREATE OR REPLACE FUNCTION public.get_my_user_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result jsonb;
    unidades_ids uuid[];
    is_master_bool boolean;
BEGIN
    is_master_bool := public.is_master(auth.uid());

    IF is_master_bool THEN
        SELECT ARRAY(SELECT id FROM public.unidades WHERE deleted_at IS NULL) INTO unidades_ids;
    ELSE
        SELECT ARRAY_AGG(unidade_id) INTO unidades_ids
        FROM public.usuario_unidades
        WHERE usuario_id = auth.uid() AND deleted_at IS NULL;
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
$function$;

-- 4. Reforçar RLS da tabela profissionais
DROP POLICY IF EXISTS profissionais_select_policy ON public.profissionais;
CREATE POLICY profissionais_select_policy ON public.profissionais
FOR SELECT
TO authenticated
USING (
    public.is_master(auth.uid()) 
    OR (unidade_id IN (
        SELECT uu.unidade_id 
        FROM public.usuario_unidades uu 
        WHERE uu.usuario_id = auth.uid() 
          AND uu.deleted_at IS NULL
    ))
);

-- 5. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_db(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_core(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_master() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated, service_role;
