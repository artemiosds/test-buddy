-- Set search_path to public for newly created functions
ALTER FUNCTION public.is_master(uuid) SET search_path = public;
ALTER FUNCTION public.current_user_unidades() SET search_path = public;
ALTER FUNCTION public.get_my_user_context() SET search_path = public;
ALTER FUNCTION public.array_distinct(anyarray) SET search_path = public;

-- Revoke public execute (anon)
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_unidades() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_user_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.array_distinct(anyarray) FROM PUBLIC;

-- Grant to authenticated only
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_unidades() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.array_distinct(anyarray) TO authenticated;
