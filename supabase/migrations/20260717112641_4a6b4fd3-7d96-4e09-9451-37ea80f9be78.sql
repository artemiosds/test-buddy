
-- pg_net não suporta ALTER EXTENSION SET SCHEMA; drop + recreate é a única
-- forma. Verificado: nenhum código do app referencia pg_net; 0 requests
-- pendentes; 360 linhas de histórico interno serão perdidas (sem impacto
-- funcional — são apenas logs do próprio pg_net).
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DROP EXTENSION IF EXISTS pg_net CASCADE;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
