-- 1. Remover triggers que podem estar causando loops ou comportamentos inesperados
DROP TRIGGER IF EXISTS tr_sync_perms_on_usuario_permissao ON public.usuario_permissoes;
DROP TRIGGER IF EXISTS tr_sync_perms_on_usuarios ON public.usuarios;

-- 2. Recriar a função de sincronização com proteções e lógica otimizada
CREATE OR REPLACE FUNCTION public.sync_user_permissions_to_jwt()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ 
DECLARE   
  _target_user_id UUID;   
  _perms TEXT[]; 
BEGIN   
  -- Identificar o ID do usuário afetado com base na tabela
  IF TG_TABLE_NAME = 'usuarios' THEN     
    -- SÓ dispara se mudar campos CRÍTICOS (perfil, status ou flags master)
    IF (OLD.perfil_id IS NOT DISTINCT FROM NEW.perfil_id AND 
        OLD.status IS NOT DISTINCT FROM NEW.status AND 
        OLD.acesso_todas_unidades IS NOT DISTINCT FROM NEW.acesso_todas_unidades AND 
        OLD.acesso_todas_secretarias IS NOT DISTINCT FROM NEW.acesso_todas_secretarias) THEN
      RETURN NEW;
    END IF;
    _target_user_id := NEW.id;   
  
  ELSIF TG_TABLE_NAME = 'usuario_permissoes' THEN     
    _target_user_id := COALESCE(NEW.usuario_id, OLD.usuario_id);   
  
  ELSIF TG_TABLE_NAME = 'perfil_permissoes' THEN
    -- Para perfis, atualizamos todos os usuários vinculados
    UPDATE auth.users au     
    SET raw_app_meta_data =       
      coalesce(au.raw_app_meta_data, '{}'::jsonb) ||       
      jsonb_build_object(         
        'permissions',         
        coalesce(public.get_user_permissions_list(au.id), '{}'::text[])       
      )     
    WHERE au.id IN (       
      SELECT u.id FROM public.usuarios u       
      WHERE u.perfil_id = COALESCE(NEW.perfil_id, OLD.perfil_id)     
    );     
    RETURN COALESCE(NEW, OLD);   
  END IF;    

  -- Executar a atualização do metadata no auth.users
  IF _target_user_id IS NOT NULL THEN     
    _perms := public.get_user_permissions_list(_target_user_id);      
    
    UPDATE auth.users     
    SET raw_app_meta_data =       
      coalesce(raw_app_meta_data, '{}'::jsonb) ||       
      jsonb_build_object('permissions', coalesce(_perms, '{}'::text[]))     
    WHERE id = _target_user_id;   
  END IF;    

  RETURN COALESCE(NEW, OLD); 
END; 
$function$;

-- 3. Criar os triggers com as restrições corretas
CREATE TRIGGER tr_sync_perms_on_usuario_permissao
AFTER INSERT OR UPDATE OR DELETE ON public.usuario_permissoes
FOR EACH ROW EXECUTE FUNCTION sync_user_permissions_to_jwt();

CREATE TRIGGER tr_sync_perms_on_usuarios
AFTER UPDATE OF perfil_id, status, acesso_todas_unidades, acesso_todas_secretarias ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION sync_user_permissions_to_jwt();

-- 4. Garantir que o perfil MASTER do usuário específico esteja correto no metadado agora
UPDATE auth.users 
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"permissions": ["Master"]}'::jsonb
WHERE email = 'yifeh27927@duvips.com';
