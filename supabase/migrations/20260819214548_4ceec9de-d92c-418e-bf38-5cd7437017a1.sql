GRANT SELECT ON public.usuarios TO authenticated, anon;
GRANT SELECT ON public.perfis TO authenticated, anon;
GRANT SELECT ON public.unidades TO authenticated, anon;
GRANT SELECT ON public.usuario_unidades TO authenticated, anon;
GRANT SELECT ON public.profissionais TO authenticated, anon;
GRANT SELECT ON public.secretarias TO authenticated, anon;
GRANT SELECT ON public.usuario_secretarias TO authenticated, anon;
GRANT SELECT ON public.setores TO authenticated, anon;
GRANT SELECT ON public.frequencias TO authenticated, anon;
GRANT SELECT ON public.competencia_unidades TO authenticated, anon;

GRANT ALL ON public.usuarios TO service_role;
GRANT ALL ON public.perfis TO service_role;
GRANT ALL ON public.unidades TO service_role;
GRANT ALL ON public.usuario_unidades TO service_role;
GRANT ALL ON public.profissionais TO service_role;
GRANT ALL ON public.secretarias TO service_role;
GRANT ALL ON public.usuario_secretarias TO service_role;
GRANT ALL ON public.setores TO service_role;
GRANT ALL ON public.frequencias TO service_role;
GRANT ALL ON public.competencia_unidades TO service_role;

GRANT EXECUTE ON FUNCTION public.get_minhas_unidades_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
