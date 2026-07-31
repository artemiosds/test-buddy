
REVOKE ALL ON FUNCTION public.rls_cache_get(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rls_cache_put(text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_master_core(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mfa_exigido_nao_atendido_core(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_unit_core(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_secretaria_core(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rls_cache_get(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rls_cache_put(text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_core(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mfa_exigido_nao_atendido_core(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_unit_core(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_secretaria_core(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission_core(uuid, text, uuid, uuid) TO authenticated, service_role;
