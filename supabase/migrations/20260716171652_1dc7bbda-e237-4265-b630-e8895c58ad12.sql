-- Onda 1 — Endurecimento de segurança (produção)
-- Sem alteração de RLS, tabelas, triggers de negócio ou comportamento funcional.

-- 1) Revogar EXECUTE de authenticated na rotina de SLA (só pg_cron/service_role precisa)
REVOKE EXECUTE ON FUNCTION public.sla_pendencias_processar() FROM authenticated;

-- 2) Trigger functions não precisam de EXECUTE para anon/authenticated/PUBLIC.
--    Elas são disparadas pelo próprio Postgres no contexto do owner.
REVOKE EXECUTE ON FUNCTION public.tg_eventos_dominio_imutavel() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_eventos_dominio_no_delete() FROM anon, authenticated, PUBLIC;

-- 3) Fixar search_path em tg_eventos_dominio_no_delete (WARN 0011)
ALTER FUNCTION public.tg_eventos_dominio_no_delete() SET search_path = public, pg_temp;