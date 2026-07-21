REVOKE EXECUTE ON FUNCTION public.usuario_pode_cadastrar_assinatura(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assinatura_pendentes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assinatura_dashboard() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notificar_assinatura_pendentes() FROM PUBLIC, anon;