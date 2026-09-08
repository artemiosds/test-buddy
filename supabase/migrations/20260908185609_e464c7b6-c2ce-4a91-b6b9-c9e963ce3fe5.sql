REVOKE EXECUTE ON FUNCTION public.audit_actor_email(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_request_ip() FROM anon;
REVOKE EXECUTE ON FUNCTION public.audit_actor_email(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.audit_request_ip() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_actor_email(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_request_ip() TO authenticated, service_role;