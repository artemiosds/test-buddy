-- =====================================================================
-- Gerenciador Universal de Provedores de IA (Piso da Enfermagem)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.piso_ia_provedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  nome text NOT NULL,
  modelo text NOT NULL DEFAULT '',
  base_url text,
  api_key text,
  timeout_ms integer NOT NULL DEFAULT 120000,
  tentativas integer NOT NULL DEFAULT 3,
  prioridade integer NOT NULL DEFAULT 100,
  ativo boolean NOT NULL DEFAULT true,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- métricas
  execucoes integer NOT NULL DEFAULT 0,
  sucessos integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  timeouts integer NOT NULL DEFAULT 0,
  erros_429 integer NOT NULL DEFAULT 0,
  erros_503 integer NOT NULL DEFAULT 0,
  pdfs integer NOT NULL DEFAULT 0,
  tempo_total_ms bigint NOT NULL DEFAULT 0,
  tempo_min_ms integer,
  tempo_max_ms integer,
  confianca_soma numeric NOT NULL DEFAULT 0,
  confianca_n integer NOT NULL DEFAULT 0,
  ultima_utilizacao timestamptz,
  ultimo_erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.piso_ia_provedores TO authenticated;
GRANT ALL ON public.piso_ia_provedores TO service_role;
ALTER TABLE public.piso_ia_provedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "piso_ia_provedores_sem_acesso_direto" ON public.piso_ia_provedores;
CREATE POLICY "piso_ia_provedores_sem_acesso_direto"
  ON public.piso_ia_provedores FOR SELECT TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.piso_ia_config (
  id boolean PRIMARY KEY DEFAULT true,
  modo text NOT NULL DEFAULT 'automatico',
  provedor_id uuid REFERENCES public.piso_ia_provedores(id) ON DELETE SET NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT piso_ia_config_unica CHECK (id)
);

GRANT SELECT ON public.piso_ia_config TO authenticated;
GRANT ALL ON public.piso_ia_config TO service_role;
ALTER TABLE public.piso_ia_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "piso_ia_config_sem_acesso_direto" ON public.piso_ia_config;
CREATE POLICY "piso_ia_config_sem_acesso_direto"
  ON public.piso_ia_config FOR SELECT TO authenticated USING (false);

INSERT INTO public.piso_ia_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Listagem pública (sem chave)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedores_listar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _lista jsonb;
  _cfg jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_permission(_uid, 'piso.visualizar', NULL, NULL)
       OR public.has_permission(_uid, 'configuracao.editar', NULL, NULL)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT COALESCE(jsonb_agg(x ORDER BY x->>'prioridade_txt', x->>'nome'), '[]'::jsonb) INTO _lista
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'tipo', p.tipo,
      'nome', p.nome,
      'modelo', p.modelo,
      'base_url', p.base_url,
      'timeout_ms', p.timeout_ms,
      'tentativas', p.tentativas,
      'prioridade', p.prioridade,
      'prioridade_txt', lpad(p.prioridade::text, 6, '0'),
      'ativo', p.ativo,
      'extra', p.extra,
      'tem_chave', (p.api_key IS NOT NULL AND length(p.api_key) > 0),
      'chave_final4', CASE WHEN p.api_key IS NOT NULL AND length(p.api_key) >= 4
                           THEN right(p.api_key, 4) ELSE NULL END,
      'metricas', jsonb_build_object(
        'execucoes', p.execucoes,
        'sucessos', p.sucessos,
        'falhas', p.falhas,
        'timeouts', p.timeouts,
        'erros_429', p.erros_429,
        'erros_503', p.erros_503,
        'pdfs', p.pdfs,
        'tempo_medio_ms', CASE WHEN p.execucoes > 0 THEN round(p.tempo_total_ms::numeric / p.execucoes) ELSE NULL END,
        'tempo_min_ms', p.tempo_min_ms,
        'tempo_max_ms', p.tempo_max_ms,
        'confianca_media', CASE WHEN p.confianca_n > 0 THEN round(p.confianca_soma / p.confianca_n, 3) ELSE NULL END,
        'ultima_utilizacao', p.ultima_utilizacao,
        'ultimo_erro', p.ultimo_erro
      )
    ) AS x
    FROM public.piso_ia_provedores p
  ) s;

  SELECT jsonb_build_object('modo', c.modo, 'provedor_id', c.provedor_id)
    INTO _cfg FROM public.piso_ia_config c WHERE c.id;

  RETURN jsonb_build_object('provedores', _lista, 'config', COALESCE(_cfg, jsonb_build_object('modo','automatico','provedor_id',NULL)));
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedores_listar() FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedores_listar() TO authenticated;

-- ---------------------------------------------------------------------
-- Criação / atualização
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedor_salvar(
  _id uuid,
  _tipo text,
  _nome text,
  _modelo text,
  _base_url text,
  _timeout_ms integer,
  _tentativas integer,
  _prioridade integer,
  _ativo boolean,
  _extra jsonb,
  _api_key text,
  _atualizar_chave boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _out uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(_uid, 'configuracao.editar', NULL, NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.piso_ia_provedores
      (tipo, nome, modelo, base_url, timeout_ms, tentativas, prioridade, ativo, extra, api_key)
    VALUES
      (_tipo, _nome, COALESCE(_modelo,''), NULLIF(_base_url,''), COALESCE(_timeout_ms,120000),
       COALESCE(_tentativas,3), COALESCE(_prioridade,100), COALESCE(_ativo,true),
       COALESCE(_extra,'{}'::jsonb), CASE WHEN _atualizar_chave THEN NULLIF(_api_key,'') ELSE NULL END)
    RETURNING id INTO _out;
  ELSE
    UPDATE public.piso_ia_provedores SET
      tipo = _tipo,
      nome = _nome,
      modelo = COALESCE(_modelo,''),
      base_url = NULLIF(_base_url,''),
      timeout_ms = COALESCE(_timeout_ms,120000),
      tentativas = COALESCE(_tentativas,3),
      prioridade = COALESCE(_prioridade,100),
      ativo = COALESCE(_ativo,true),
      extra = COALESCE(_extra,'{}'::jsonb),
      api_key = CASE WHEN _atualizar_chave THEN NULLIF(_api_key,'') ELSE api_key END,
      atualizado_em = now()
    WHERE id = _id
    RETURNING id INTO _out;
  END IF;

  RETURN _out;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedor_salvar(uuid,text,text,text,text,integer,integer,integer,boolean,jsonb,text,boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedor_salvar(uuid,text,text,text,text,integer,integer,integer,boolean,jsonb,text,boolean) TO authenticated;

-- ---------------------------------------------------------------------
-- Exclusão
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedor_excluir(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(_uid, 'configuracao.editar', NULL, NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  DELETE FROM public.piso_ia_provedores WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedor_excluir(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedor_excluir(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Reordenação (drag-and-drop)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedores_ordenar(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); i integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(_uid, 'configuracao.editar', NULL, NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  FOR i IN 1 .. COALESCE(array_length(_ids, 1), 0) LOOP
    UPDATE public.piso_ia_provedores SET prioridade = i, atualizado_em = now() WHERE id = _ids[i];
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedores_ordenar(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedores_ordenar(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------
-- Modo automático / manual
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_config_salvar(_modo text, _provedor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(_uid, 'configuracao.editar', NULL, NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  INSERT INTO public.piso_ia_config (id, modo, provedor_id, atualizado_em)
  VALUES (true, COALESCE(_modo,'automatico'), _provedor_id, now())
  ON CONFLICT (id) DO UPDATE
    SET modo = EXCLUDED.modo, provedor_id = EXCLUDED.provedor_id, atualizado_em = now();
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_config_salvar(text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_config_salvar(text, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Cadeia de execução (com chave) — server-side apenas, exige piso.importar
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_cadeia()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _modo text;
  _pid uuid;
  _lista jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.has_permission(_uid, 'piso.importar', NULL, NULL) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT c.modo, c.provedor_id INTO _modo, _pid FROM public.piso_ia_config c WHERE c.id;
  _modo := COALESCE(_modo, 'automatico');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'modelo', p.modelo,
      'base_url', p.base_url, 'api_key', p.api_key,
      'timeout_ms', p.timeout_ms, 'tentativas', p.tentativas,
      'prioridade', p.prioridade, 'extra', p.extra
    ) ORDER BY p.prioridade, p.nome), '[]'::jsonb)
  INTO _lista
  FROM public.piso_ia_provedores p
  WHERE p.ativo AND (_modo <> 'manual' OR p.id = _pid);

  RETURN jsonb_build_object('modo', _modo, 'provedores', _lista);
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_cadeia() FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_cadeia() TO authenticated;

-- ---------------------------------------------------------------------
-- Chave de um provedor (teste de conexão)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedor_key(_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _k text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_permission(_uid, 'configuracao.editar', NULL, NULL)
       OR public.has_permission(_uid, 'piso.importar', NULL, NULL)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT api_key INTO _k FROM public.piso_ia_provedores WHERE id = _id;
  RETURN _k;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedor_key(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedor_key(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Registro de métricas
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.piso_ia_provedor_metrica(
  _id uuid,
  _ok boolean,
  _ms integer,
  _status integer,
  _erro text,
  _confianca numeric,
  _pdfs integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_permission(_uid, 'piso.importar', NULL, NULL)
       OR public.has_permission(_uid, 'configuracao.editar', NULL, NULL)) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.piso_ia_provedores SET
    execucoes = execucoes + 1,
    sucessos = sucessos + CASE WHEN _ok THEN 1 ELSE 0 END,
    falhas = falhas + CASE WHEN _ok THEN 0 ELSE 1 END,
    timeouts = timeouts + CASE WHEN NOT _ok AND _status = 408 THEN 1 ELSE 0 END,
    erros_429 = erros_429 + CASE WHEN _status = 429 THEN 1 ELSE 0 END,
    erros_503 = erros_503 + CASE WHEN _status IN (503, 529) THEN 1 ELSE 0 END,
    pdfs = pdfs + COALESCE(_pdfs, 0),
    tempo_total_ms = tempo_total_ms + COALESCE(_ms, 0),
    tempo_min_ms = LEAST(COALESCE(tempo_min_ms, COALESCE(_ms, 0)), COALESCE(_ms, 0)),
    tempo_max_ms = GREATEST(COALESCE(tempo_max_ms, 0), COALESCE(_ms, 0)),
    confianca_soma = confianca_soma + COALESCE(_confianca, 0),
    confianca_n = confianca_n + CASE WHEN _confianca IS NULL THEN 0 ELSE 1 END,
    ultima_utilizacao = now(),
    ultimo_erro = CASE WHEN _ok THEN ultimo_erro ELSE left(COALESCE(_erro,''), 500) END,
    atualizado_em = now()
  WHERE id = _id;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_ia_provedor_metrica(uuid,boolean,integer,integer,text,numeric,integer) FROM public;
GRANT EXECUTE ON FUNCTION public.piso_ia_provedor_metrica(uuid,boolean,integer,integer,text,numeric,integer) TO authenticated;