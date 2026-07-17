-- =============================================================================
-- Security regression smoke tests  (output em tabela — SQL Editor friendly)
-- =============================================================================
-- Cobertura:
--   5A.1 — guards SECURITY DEFINER: is_master, has_permission,
--          user_has_unit, user_has_secretaria, proximo_numero_pendencia
--   5C.2 — policies estreitadas: usuarios / usuario_permissoes SELECT
--   Regressão: get_my_user_context() legível pelo próprio usuário.
--
-- COMO RODAR (SQL Editor do Supabase)
-- ---------------------------------------------------------------------------
-- Cole em UMA execução, na ordem:
--
--   SET app.test_master_id = '<uuid-master>';
--   SET app.test_common_id = '<uuid-comum>';
--   -- ... todo o conteúdo abaixo ...
--
-- Não commite os UUIDs em lugar nenhum do repo.
--
-- O resultado sai como uma grade na aba de resultados:
--
--   seq | grupo | label                                 | status | detail
--   ----+-------+---------------------------------------+--------+--------
--     1 | 5A.1  | is_master(alheio) como comum → 42501  | OK     |
--     2 | 5A.1  | is_master(self) como comum → sem erro | OK     |
--     ...
--
-- Nenhum RAISE NOTICE é emitido para os testes — falhas viram linhas com
-- status='FAIL' + explicação em 'detail'. O script NÃO faz writes em nenhuma
-- tabela real: só cria funções em pg_temp e lê tabelas via RLS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Acumulador de resultados (temp table de sessão)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS _sec_test_results;
CREATE TEMP TABLE _sec_test_results (
  seq    serial PRIMARY KEY,
  grupo  text,
  label  text,
  status text,          -- 'OK' | 'FAIL' | 'SKIP'
  detail text
);

-- ---------------------------------------------------------------------------
-- 0. Sanity — GUCs presentes e usuários existem (aborta com erro se faltar)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_master text := current_setting('app.test_master_id', true);
  v_common text := current_setting('app.test_common_id', true);
BEGIN
  IF v_master IS NULL OR v_master = '' THEN
    RAISE EXCEPTION
      'GUC app.test_master_id não definido. Rode "SET app.test_master_id = ''<uuid>'';" no mesmo batch.';
  END IF;
  IF v_common IS NULL OR v_common = '' THEN
    RAISE EXCEPTION
      'GUC app.test_common_id não definido. Rode "SET app.test_common_id = ''<uuid>'';" no mesmo batch.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_master::uuid) THEN
    RAISE EXCEPTION 'app.test_master_id (%) não existe em public.usuarios', v_master;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_common::uuid) THEN
    RAISE EXCEPTION 'app.test_common_id (%) não existe em public.usuarios', v_common;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers de sessão e assert (não lançam exceção nos testes — inserem linhas)
-- ---------------------------------------------------------------------------
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

CREATE OR REPLACE FUNCTION pg_temp.rec(
  _grupo text, _label text, _status text, _detail text DEFAULT NULL
) RETURNS void LANGUAGE sql AS $$
  INSERT INTO _sec_test_results(grupo, label, status, detail)
  VALUES (_grupo, _label, _status, _detail);
$$;

-- Executa _sql como authenticated(_uid) e registra OK se levantar 42501,
-- FAIL caso contrário. Nunca propaga a exceção.
CREATE OR REPLACE FUNCTION pg_temp.expect_denied(
  _grupo text, _uid uuid, _sql text, _label text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_msg   text;
BEGIN
  PERFORM pg_temp.sec_login(_uid);
  BEGIN
    EXECUTE _sql;
    PERFORM pg_temp.sec_logout();
    PERFORM pg_temp.rec(_grupo, _label, 'FAIL', 'esperava 42501, execução foi bem-sucedida');
    RETURN;
  EXCEPTION
    WHEN insufficient_privilege THEN
      PERFORM pg_temp.sec_logout();
      PERFORM pg_temp.rec(_grupo, _label, 'OK', NULL);
      RETURN;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
      PERFORM pg_temp.sec_logout();
      PERFORM pg_temp.rec(_grupo, _label, 'FAIL',
        format('esperava 42501, obteve SQLSTATE %s: %s', v_state, v_msg));
      RETURN;
  END;
END $$;

-- Executa _sql como authenticated(_uid) e registra OK se retornar sem erro,
-- FAIL se qualquer exceção acontecer. Nunca propaga.
CREATE OR REPLACE FUNCTION pg_temp.expect_ok(
  _grupo text, _uid uuid, _sql text, _label text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_state text;
  v_msg   text;
BEGIN
  PERFORM pg_temp.sec_login(_uid);
  BEGIN
    EXECUTE _sql;
    PERFORM pg_temp.sec_logout();
    PERFORM pg_temp.rec(_grupo, _label, 'OK', NULL);
    RETURN;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    PERFORM pg_temp.sec_logout();
    PERFORM pg_temp.rec(_grupo, _label, 'FAIL',
      format('erro inesperado SQLSTATE %s: %s', v_state, v_msg));
    RETURN;
  END;
END $$;

-- =============================================================================
-- 5A.1 — Guards SECURITY DEFINER
-- =============================================================================

-- is_master
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
BEGIN
  PERFORM pg_temp.expect_denied('5A.1', v_common,
    format('SELECT public.is_master(%L::uuid)', v_master),
    'is_master(alheio) como comum → 42501');
  PERFORM pg_temp.expect_ok('5A.1', v_common,
    format('SELECT public.is_master(%L::uuid)', v_common),
    'is_master(self) como comum → sem erro');
  PERFORM pg_temp.expect_ok('5A.1', v_master,
    format('SELECT public.is_master(%L::uuid)', v_common),
    'is_master(alheio) como master → sem erro');
END $$;

-- has_permission
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
BEGIN
  PERFORM pg_temp.expect_denied('5A.1', v_common,
    format('SELECT public.has_permission(%L::uuid, %L)', v_master, 'usuario.gerenciar'),
    'has_permission(alheio, x) como comum → 42501');
  PERFORM pg_temp.expect_ok('5A.1', v_common,
    format('SELECT public.has_permission(%L::uuid, %L)', v_common, 'usuario.gerenciar'),
    'has_permission(self, x) como comum → sem erro');
END $$;

-- user_has_unit / user_has_secretaria
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_dummy  uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  PERFORM pg_temp.expect_denied('5A.1', v_common,
    format('SELECT public.user_has_unit(%L::uuid, %L::uuid)', v_master, v_dummy),
    'user_has_unit(alheio) como comum → 42501');
  PERFORM pg_temp.expect_denied('5A.1', v_common,
    format('SELECT public.user_has_secretaria(%L::uuid, %L::uuid)', v_master, v_dummy),
    'user_has_secretaria(alheio) como comum → 42501');
  PERFORM pg_temp.expect_ok('5A.1', v_common,
    format('SELECT public.user_has_unit(%L::uuid, %L::uuid)', v_common, v_dummy),
    'user_has_unit(self) como comum → sem erro');
  PERFORM pg_temp.expect_ok('5A.1', v_common,
    format('SELECT public.user_has_secretaria(%L::uuid, %L::uuid)', v_common, v_dummy),
    'user_has_secretaria(self) como comum → sem erro');
END $$;

-- proximo_numero_pendencia (assinatura: proximo_numero_pendencia(_secretaria_id uuid))
DO $$
DECLARE
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_dummy  uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF public.has_permission(v_common, 'pendencia.criar') THEN
    PERFORM pg_temp.rec('5A.1',
      'proximo_numero_pendencia sem pendencia.criar → 42501',
      'SKIP', 'app.test_common_id tem pendencia.criar');
  ELSE
    PERFORM pg_temp.expect_denied('5A.1', v_common,
      format('SELECT public.proximo_numero_pendencia(%L::uuid)', v_dummy),
      'proximo_numero_pendencia sem pendencia.criar → 42501');
  END IF;
END $$;

-- =============================================================================
-- Regressão — get_my_user_context legível pelo próprio usuário
-- =============================================================================
DO $$
DECLARE
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_count  int;
  v_state  text;
  v_msg    text;
BEGIN
  PERFORM pg_temp.sec_login(v_common);
  BEGIN
    SELECT COUNT(*) INTO v_count FROM public.get_my_user_context();
    PERFORM pg_temp.sec_logout();
    IF v_count < 1 THEN
      PERFORM pg_temp.rec('regressão',
        'get_my_user_context() como próprio usuário → ≥1 linha',
        'FAIL', format('obteve %s linha(s)', v_count));
    ELSE
      PERFORM pg_temp.rec('regressão',
        'get_my_user_context() como próprio usuário → ≥1 linha',
        'OK', format('%s linha(s)', v_count));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_state = RETURNED_SQLSTATE, v_msg = MESSAGE_TEXT;
    PERFORM pg_temp.sec_logout();
    PERFORM pg_temp.rec('regressão',
      'get_my_user_context() como próprio usuário → ≥1 linha',
      'FAIL', format('SQLSTATE %s: %s', v_state, v_msg));
  END;
END $$;

-- =============================================================================
-- 5C.2 — Policies estreitadas de usuarios / usuario_permissoes
-- =============================================================================
DO $$
DECLARE
  v_master uuid := current_setting('app.test_master_id')::uuid;
  v_common uuid := current_setting('app.test_common_id')::uuid;
  v_count_common int;
  v_count_master int;
  v_perm_common  int;
BEGIN
  IF public.has_permission(v_common, 'usuario.gerenciar') THEN
    PERFORM pg_temp.rec('5C.2',
      'comum sem usuario.gerenciar vê só a si em usuarios',
      'SKIP', 'app.test_common_id tem usuario.gerenciar');
    PERFORM pg_temp.rec('5C.2',
      'comum sem usuario.gerenciar vê 0 overrides alheios em usuario_permissoes',
      'SKIP', 'app.test_common_id tem usuario.gerenciar');
  ELSE
    PERFORM pg_temp.sec_login(v_common);
    SELECT COUNT(*) INTO v_count_common FROM public.usuarios;
    SELECT COUNT(*) INTO v_perm_common
      FROM public.usuario_permissoes
      WHERE usuario_id <> v_common;
    PERFORM pg_temp.sec_logout();

    IF v_count_common = 1 THEN
      PERFORM pg_temp.rec('5C.2',
        'comum sem usuario.gerenciar vê só a si em usuarios',
        'OK', NULL);
    ELSE
      PERFORM pg_temp.rec('5C.2',
        'comum sem usuario.gerenciar vê só a si em usuarios',
        'FAIL', format('viu %s linha(s), esperado 1', v_count_common));
    END IF;

    IF v_perm_common = 0 THEN
      PERFORM pg_temp.rec('5C.2',
        'comum sem usuario.gerenciar vê 0 overrides alheios em usuario_permissoes',
        'OK', NULL);
    ELSE
      PERFORM pg_temp.rec('5C.2',
        'comum sem usuario.gerenciar vê 0 overrides alheios em usuario_permissoes',
        'FAIL', format('viu %s override(s) de outros usuários', v_perm_common));
    END IF;
  END IF;

  PERFORM pg_temp.sec_login(v_master);
  SELECT COUNT(*) INTO v_count_master FROM public.usuarios;
  PERFORM pg_temp.sec_logout();

  IF v_count_master >= 2 THEN
    PERFORM pg_temp.rec('5C.2',
      'master vê ≥2 linhas em usuarios',
      'OK', format('%s linha(s)', v_count_master));
  ELSE
    PERFORM pg_temp.rec('5C.2',
      'master vê ≥2 linhas em usuarios',
      'FAIL', format('viu %s linha(s)', v_count_master));
  END IF;
END $$;

-- =============================================================================
-- Resultado (grade final + resumo)
-- =============================================================================
SELECT seq, grupo, label, status, detail
FROM _sec_test_results
ORDER BY seq;

-- Resumo agregado — última query da execução; alguns clientes mostram só a
-- última grade, outros mostram todas. Se seu editor mostra só a última,
-- comente esta linha e mantenha o SELECT acima.
SELECT
  COUNT(*)                                    AS total,
  COUNT(*) FILTER (WHERE status = 'OK')       AS ok,
  COUNT(*) FILTER (WHERE status = 'FAIL')     AS fail,
  COUNT(*) FILTER (WHERE status = 'SKIP')     AS skip
FROM _sec_test_results;