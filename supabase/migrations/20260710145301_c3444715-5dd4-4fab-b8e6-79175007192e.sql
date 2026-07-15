
-- Restringe EXECUTE da função utilitária apenas ao owner/service_role.
-- Ela é usada exclusivamente por triggers BEFORE UPDATE.
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.tg_set_updated_at() FROM authenticated;

-- Move extensões que estejam no schema public para o schema extensions.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  ext text;
BEGIN
  FOREACH ext IN ARRAY ARRAY['citext','pg_trgm','btree_gist','pgcrypto'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
      WHERE e.extname = ext AND n.nspname = 'public'
    ) THEN
      EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext);
    END IF;
  END LOOP;
END $$;
