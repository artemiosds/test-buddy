
-- Correção de segurança para funções críticas (search_path e revogação de permissões públicas)
-- Removida a tabela inexistente folhas_pagamento do script

-- 1. is_master
ALTER FUNCTION public.is_master(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated, service_role;

-- 2. is_master_db
ALTER FUNCTION public.is_master_db(uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.is_master_db(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_db(uuid) TO authenticated, service_role;

-- 3. has_permission
ALTER FUNCTION public.has_permission(uuid, text, uuid, uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text, uuid, uuid) TO authenticated, service_role;

-- 4. get_my_user_context
ALTER FUNCTION public.get_my_user_context() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.get_my_user_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated, service_role;

-- 5. has_permission_core
ALTER FUNCTION public.has_permission_core(uuid, text, uuid, uuid) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO authenticated, service_role;
