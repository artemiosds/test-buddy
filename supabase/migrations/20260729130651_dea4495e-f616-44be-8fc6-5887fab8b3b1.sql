REVOKE EXECUTE ON FUNCTION public.hsm_config_ler() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.hsm_config_ler() FROM anon;
GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO service_role;