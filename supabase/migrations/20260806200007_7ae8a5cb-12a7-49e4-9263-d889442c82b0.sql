-- 1. Função para extrair permissões do usuário
CREATE OR REPLACE FUNCTION public.get_user_permissions_list(_user_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(DISTINCT p.codigo)
  FROM public.permissoes p
  JOIN public.perfil_permissoes pp ON pp.permissao_id = p.id
  JOIN public.perfis pr ON pr.id = pp.perfil_id
  JOIN public.usuarios u ON u.perfil_id = pr.id
  WHERE u.id = _user_id;
$$;

-- 2. Função Security Definer para atualizar o app_metadata
CREATE OR REPLACE FUNCTION public.sync_user_permissions_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _target_user_id UUID;
  _perms TEXT[];
BEGIN
  IF TG_TABLE_NAME = 'usuarios' THEN
    _target_user_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'perfil_permissoes' THEN
    UPDATE auth.users
    SET raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('permissions', (SELECT public.get_user_permissions_list(id) FROM public.usuarios WHERE perfil_id = NEW.perfil_id))
    WHERE id IN (SELECT id FROM public.usuarios WHERE perfil_id = NEW.perfil_id);
    RETURN NULL;
  END IF;

  IF _target_user_id IS NOT NULL THEN
    _perms := public.get_user_permissions_list(_target_user_id);
    
    UPDATE auth.users
    SET raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('permissions', coalesce(_perms, '{}'::text[]))
    WHERE id = _target_user_id;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Triggers
DROP TRIGGER IF EXISTS tr_sync_perms_on_user_update ON public.usuarios;
CREATE TRIGGER tr_sync_perms_on_user_update
AFTER INSERT OR UPDATE OF perfil_id ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.sync_user_permissions_to_jwt();

DROP TRIGGER IF EXISTS tr_sync_perms_on_perfil_change ON public.perfil_permissoes;
CREATE TRIGGER tr_sync_perms_on_perfil_change
AFTER INSERT OR UPDATE OR DELETE ON public.perfil_permissoes
FOR EACH ROW EXECUTE FUNCTION public.sync_user_permissions_to_jwt();

-- 4. Função auxiliar para RLS
CREATE OR REPLACE FUNCTION public.jwt_has_permission(_perm TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' -> 'permissions') ? _perm, false);
$$;

-- 5. Sync inicial
DO $$
DECLARE 
  _u RECORD;
  _p TEXT[];
BEGIN
  FOR _u IN SELECT id FROM auth.users LOOP
    _p := public.get_user_permissions_list(_u.id);
    UPDATE auth.users
    SET raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('permissions', coalesce(_p, '{}'::text[]))
    WHERE id = _u.id;
  END LOOP;
END $$;
