-- 1. Reescrever a função de lista de permissões com lógica de paridade total
CREATE OR REPLACE FUNCTION public.get_user_permissions_list(_user_id uuid)
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    _is_master boolean;
    _perfil_id uuid;
    _status text;
    _perms text[];
BEGIN
    -- Busca dados base do usuário
    SELECT 
        (u.acesso_todas_unidades AND u.acesso_todas_secretarias),
        u.perfil_id,
        u.status
    INTO _is_master, _perfil_id, _status
    FROM public.usuarios u
    WHERE u.id = _user_id AND u.deleted_at IS NULL;

    -- Se usuário não existe ou não está ativo, retorna vazio
    IF _status IS DISTINCT FROM 'ativo' THEN
        RETURN '{}'::text[];
    END IF;

    -- Se for Master, retorna todas as permissões ativas
    IF _is_master THEN
        SELECT array_agg(codigo) INTO _perms
        FROM public.permissoes
        WHERE ativa = true AND deleted_at IS NULL;
        RETURN coalesce(_perms, '{}'::text[]);
    END IF;

    -- Caso contrário, calcula permissões efetivas (Perfil + Concedidas - Revogadas)
    SELECT array_agg(DISTINCT codigo) INTO _perms
    FROM (
        -- Permissões do Perfil
        SELECT p.codigo
        FROM public.permissoes p
        JOIN public.perfil_permissoes pp ON pp.permissao_id = p.id
        WHERE pp.perfil_id = _perfil_id 
          AND pp.concedida = true 
          AND p.ativa = true 
          AND p.deleted_at IS NULL
        
        UNION
        
        -- Concessões Individuais
        SELECT p.codigo
        FROM public.permissoes p
        JOIN public.usuario_permissoes up ON up.permissao_id = p.id
        WHERE up.usuario_id = _user_id 
          AND up.tipo = 'concedida' 
          AND up.deleted_at IS NULL 
          AND up.valido_de <= now() 
          AND (up.valido_ate IS NULL OR up.valido_ate > now())
          AND p.ativa = true 
          AND p.deleted_at IS NULL
          
        EXCEPT
        
        -- Revogações Individuais
        SELECT p.codigo
        FROM public.permissoes p
        JOIN public.usuario_permissoes up ON up.permissao_id = p.id
        WHERE up.usuario_id = _user_id 
          AND up.tipo = 'revogada' 
          AND up.deleted_at IS NULL
          AND up.valido_de <= now() 
          AND (up.valido_ate IS NULL OR up.valido_ate > now())
    ) effective;

    RETURN coalesce(_perms, '{}'::text[]);
END;
$function$;

-- 2. Garantir que o trigger de sincronização cubra a tabela usuario_permissoes
-- A função sync_user_permissions_to_jwt já foi definida em turno anterior, mas vamos reforçar 
-- a idempotência e os vínculos corretos.

DROP TRIGGER IF EXISTS tr_sync_perms_on_usuario_permissao ON public.usuario_permissoes;
CREATE TRIGGER tr_sync_perms_on_usuario_permissao
AFTER INSERT OR UPDATE OR DELETE ON public.usuario_permissoes
FOR EACH ROW EXECUTE FUNCTION public.sync_user_permissions_to_jwt();

-- 3. Sincronização Retroativa para usuários ativos
DO $$
DECLARE
    u RECORD;
BEGIN
    FOR u IN SELECT id FROM public.usuarios WHERE status = 'ativo' AND deleted_at IS NULL LOOP
        UPDATE auth.users
        SET raw_app_meta_data = 
          coalesce(raw_app_meta_data, '{}'::jsonb) || 
          jsonb_build_object('permissions', coalesce(public.get_user_permissions_list(u.id), '{}'::text[]))
        WHERE id = u.id;
    END LOOP;
END $$;