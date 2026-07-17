-- =============================================================================
-- Security regression smoke tests
-- =============================================================================
-- Cobertura:
--   5A.1 — guards SECURITY DEFINER: is_master, has_permission,
--          user_has_unit, user_has_secretaria, proximo_numero_pendencia
--   5C.2 — policies estreitadas: usuarios / usuario_permissoes SELECT
--          (usuario.gerenciar escopado por secretaria)
--   Regressão: get_my_user_context() legível pelo próprio usuário.
--
-- COMO RODAR
-- ---------------------------------------------------------------------------
-- Este script NÃO contém UUIDs reais. Ele lê dois GUCs obrigatórios:
--   app.test_master_id   — UUID de um usuário Master de teste
--   app.test_common_id   — UUID de um usuário comum (não-master) de teste
--
-- Ambos devem existir em auth.users e public.usuarios. Se algum não estiver
-- definido, o script aborta na primeira asserção com mensagem clara.
--
-- Exemplo de execução (não commitar UUIDs reais em nenhum lugar do repo):
--
--   psql "$DATABASE_URL" \
--     -v ON_ERROR_STOP=1 \
--     -c "SET app.test_master_id = '<uuid-master>';" \
--     -c "SET app.test_common_id = '<uuid-comum>';" \
--     -f supabase/tests/security_regression.sql
--
-- Em CI, injete os UUIDs a partir de secrets — nunca do arquivo.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Sanity — GUCs presentes e usuários existem
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_master text := current_setting('app.test_master_id', true);
  v_common text := current_setting('app.test_common_id', true);
BEGIN
  IF v_master IS NULL OR v_master = '' THEN
    RAISE EXCEPTION
      'GUC app.test_master_id não definido. Passe via psql -c "SET app.test_master_id = ''<uuid>'';" antes do -f.';
  END IF;
  IF v_common IS NULL OR v_common = '' THEN
    RAISE EXCEPTION
      'GUC app.test_common_id não definido. Passe via psql -c "SET app.test_common_id = ''<uuid>'';" antes do -f.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_master::uuid) THEN
    RAISE EXCEPTION 'app.test_master_id (%) não existe em public.usuarios', v_master;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_common::uuid) THEN
    RAISE EXCEPTION 'app.test_common_id (%) não existe em public.usuarios', v_common;
  END IF;
END $$;

-- Helpers para trocar de identidade dentro da transação.
-- request.jwt.claims é o que auth.uid() lê no runtime do Supabase.
CREATE OR REPLACE FUNCTION pg_temp.sec_login(_uid uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', _uid::text, 'role', 'authenticated')::text,
    true
  );
END $$;

CREATE OR REPLACE FUNCTION pg_temp.sec_logout() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
  RESET ROLE;
END $$;

-- Executa um SQL como authenticated(_uid) e afirma que ele levanta SQLSTATE 42501.
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(_uid uuid, _sql text, _label text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
BEGIN
  PERFORM pg_temp.sec_login(_uid);
  BEGIN
    EXECUTE _sql;
    PERFORM pg_temp.sec_logout();
    RAISE EXCEPTION 'FAIL [%]: esperado 42501 (permission denied), mas execução foi bem-sucedida.', _label;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.sec_logout();
      RAISE NOTICE 'OK   [%]: bloqueado com 42501 como esperado.', _label;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE;
      PERFORM pg_temp.sec_logout();
      RAISE EXCEPTION 'FAIL [%]: esperado 42501, obtido SQLSTATE %: %', _label, v_state, SQLERRM;
  END;
END $$;

-- Executa como authenticated(_uid) e afirma que retorna sem erro.
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(_uid uuid, _sql text, _label text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_temp.sec_login(_uid);
  BEGIN
    EXECUTE _sql;
    PERFORM pg_temp.sec_logout();
    RAISE NOTICE 'OK   [%]: executou sem erro.', _label;
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.sec_logout();
    RAISE EXCEPTION 'FAIL [%]: erro inesperado (%): %', _label, SQLSTATE, SQLERRM;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- UUIDs são lidos via current_setting('app.test_*') dentro de cada bloco DO.
-- Nada de \set + shell aqui — o script é auto-contido no psql.
-- ---------------------------------------------------------------------------

-- =============================================================================
-- 5A.1 — Guards SECURITY DEFINER
-- =============================================================================

-- is_master: usuário comum não pode consultar status de outro usuário.
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
BEGIN
  PERFORM pg_temp.expect_denied(
    v_common,
    format('SELECT public.is_master(%L::uuid)', v_master),
    'is_master(alheio) como comum → 42501'
  );
  PERFORM pg_temp.expect_ok(
    v_common,
    format('SELECT public.is_master(%L::uuid)', v_common),
    'is_master(self) como comum → sem erro'
  );
  PERFORM pg_temp.expect_ok(
    v_master,
    format('SELECT public.is_master(%L::uuid)', v_common),
    'is_master(alheio) como master → sem erro'
  );
END $$;

-- has_permission: usuário comum não pode consultar permissões alheias.
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
BEGIN
  PERFORM pg_temp.expect_denied(
    v_common,
    format('SELECT public.has_permission(%L::uuid, %L)', v_master, 'usuario.gerenciar'),
    'has_permission(alheio, x) como comum → 42501'
  );
  PERFORM pg_temp.expect_ok(
    v_common,
    format('SELECT public.has_permission(%L::uuid, %L)', v_common, 'usuario.gerenciar'),
    'has_permission(self, x) como comum → sem erro'
  );
END $$;

-- user_has_unit / user_has_secretaria: comum não consulta vínculos alheios.
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_dummy  uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM pg_temp.expect_denied(
    v_common,
    format('SELECT public.user_has_unit(%L::uuid, %L::uuid)', v_master, v_dummy),
    'user_has_unit(alheio) como comum → 42501'
  );
  PERFORM pg_temp.expect_denied(
    v_common,
    format('SELECT public.user_has_secretaria(%L::uuid, %L::uuid)', v_master, v_dummy),
    'user_has_secretaria(alheio) como comum → 42501'
  );
  PERFORM pg_temp.expect_ok(
    v_common,
    format('SELECT public.user_has_unit(%L::uuid, %L::uuid)', v_common, v_dummy),
    'user_has_unit(self) como comum → sem erro'
  );
  PERFORM pg_temp.expect_ok(
    v_common,
    format('SELECT public.user_has_secretaria(%L::uuid, %L::uuid)', v_common, v_dummy),
    'user_has_secretaria(self) como comum → sem erro'
  );
END $$;

-- proximo_numero_pendencia: exige pendencia.criar; comum de teste não tem.
DO $$
DECLARE
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_dummy  uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF public.has_permission(v_common, 'pendencia.criar') THEN
    RAISE NOTICE 'SKIP [proximo_numero_pendencia]: app.test_common_id tem pendencia.criar; asserção não aplicável.';
  ELSE
    PERFORM pg_temp.expect_denied(
      v_common,
      format('SELECT public.proximo_numero_pendencia(%L::uuid)', v_dummy),
      'proximo_numero_pendencia sem pendencia.criar → 42501'
    );
  END IF;
END $$;

-- =============================================================================
-- Regressão — get_my_user_context é legível pelo próprio usuário
-- =============================================================================
DO $$
DECLARE
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_count  int;
BEGIN
  PERFORM pg_temp.sec_login(v_common);
  SELECT COUNT(*) INTO v_count FROM public.get_my_user_context();
  PERFORM pg_temp.sec_logout();
  IF v_count < 1 THEN
    RAISE EXCEPTION 'FAIL [get_my_user_context]: esperado ≥1 linha para o próprio usuário, obtido %.', v_count;
  END IF;
  RAISE NOTICE 'OK   [get_my_user_context]: retornou % linha(s).', v_count;
END $$;

-- =============================================================================
-- 5C.2 — Policies estreitadas de usuarios / usuario_permissoes
-- =============================================================================
-- Comum sem usuario.gerenciar deve enxergar APENAS a própria linha em
-- public.usuarios e apenas seus próprios overrides em usuario_permissoes.
-- Master deve enxergar > que o comum.

DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_count_common int;
  v_count_master int;
  v_perm_common  int;
BEGIN
  IF public.has_permission(v_common, 'usuario.gerenciar') THEN
    RAISE NOTICE 'SKIP [5C.2 usuarios]: app.test_common_id tem usuario.gerenciar; asserção não aplicável.';
  ELSE
    PERFORM pg_temp.sec_login(v_common);
    SELECT COUNT(*) INTO v_count_common FROM public.usuarios;
    SELECT COUNT(*) INTO v_perm_common
      FROM public.usuario_permissoes
      WHERE usuario_id <> v_common;
    PERFORM pg_temp.sec_logout();

    IF v_count_common <> 1 THEN
      RAISE EXCEPTION
        'FAIL [5C.2 usuarios]: comum deveria ver exatamente 1 linha em public.usuarios (a si), viu %.',
        v_count_common;
    END IF;
    IF v_perm_common <> 0 THEN
      RAISE EXCEPTION
        'FAIL [5C.2 usuario_permissoes]: comum viu % overrides de OUTROS usuários; esperado 0.',
        v_perm_common;
    END IF;
    RAISE NOTICE 'OK   [5C.2]: comum vê 1 linha em usuarios e 0 overrides alheios.';
  END IF;

  PERFORM pg_temp.sec_login(v_master);
  SELECT COUNT(*) INTO v_count_master FROM public.usuarios;
  PERFORM pg_temp.sec_logout();

  IF v_count_master < 2 THEN
    RAISE EXCEPTION
      'FAIL [5C.2 master]: master deveria ver ≥2 linhas em public.usuarios, viu %.',
      v_count_master;
  END IF;
  RAISE NOTICE 'OK   [5C.2 master]: master vê % linhas em usuarios.', v_count_master;
END $$;

-- Rollback: script é apenas leitura + asserções, nada persistido.
ROLLBACK;

\echo '============================================================'
\echo ' security_regression.sql: TODOS OS TESTES PASSARAM.'
\echo '============================================================'