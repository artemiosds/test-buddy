
-- Tabela de eventos de uso (anônimos)
CREATE TABLE public.uso_eventos (
  id BIGSERIAL PRIMARY KEY,
  evento TEXT NOT NULL,
  rota TEXT,
  perfil_codigo TEXT,
  sessao_hash TEXT,
  contexto JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_uso_eventos_created_at ON public.uso_eventos (created_at DESC);
CREATE INDEX idx_uso_eventos_evento ON public.uso_eventos (evento, created_at DESC);
CREATE INDEX idx_uso_eventos_rota ON public.uso_eventos (rota, created_at DESC);

GRANT SELECT ON public.uso_eventos TO authenticated;
GRANT ALL ON public.uso_eventos TO service_role;

ALTER TABLE public.uso_eventos ENABLE ROW LEVEL SECURITY;

-- Somente Master pode ler diretamente (dados agregados/analíticos)
CREATE POLICY "uso_eventos_master_select"
  ON public.uso_eventos FOR SELECT
  TO authenticated
  USING (public.is_master(auth.uid()));

-- Inserção só via RPC (SECURITY DEFINER), portanto sem política de INSERT.

-- RPC pública (para authenticated) que grava evento anônimo
CREATE OR REPLACE FUNCTION public.track_uso(
  _evento TEXT,
  _rota TEXT DEFAULT NULL,
  _contexto JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _uid UUID := auth.uid();
  _perfil TEXT;
  _hash TEXT;
  _ctx JSONB;
BEGIN
  IF _uid IS NULL THEN
    RETURN; -- ignora silenciosamente chamadas anônimas
  END IF;

  IF _evento IS NULL OR length(_evento) = 0 OR length(_evento) > 64 THEN
    RAISE EXCEPTION 'evento inválido (1..64 chars)' USING ERRCODE = '22023';
  END IF;

  IF octet_length(coalesce(_contexto::text, '')) > 4096 THEN
    RAISE EXCEPTION 'contexto excede 4KB' USING ERRCODE = '22023';
  END IF;

  SELECT p.codigo INTO _perfil
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
   WHERE u.id = _uid AND u.deleted_at IS NULL;

  -- sessão anônima: hash diário do uid (não reversível ao usuário sem sal fora do banco)
  _hash := encode(digest(_uid::text || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD'), 'sha256'), 'hex');

  _ctx := coalesce(_contexto, '{}'::jsonb);

  INSERT INTO public.uso_eventos(evento, rota, perfil_codigo, sessao_hash, contexto)
  VALUES (_evento, NULLIF(left(coalesce(_rota,''), 256), ''), _perfil, left(_hash, 32), _ctx);
END;
$$;

REVOKE ALL ON FUNCTION public.track_uso(TEXT, TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.track_uso(TEXT, TEXT, JSONB) TO authenticated;

-- RPC MASTER-only para agregações de uso
CREATE OR REPLACE FUNCTION public.uso_metricas(_dias INT DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller UUID := auth.uid();
  _desde TIMESTAMPTZ;
  _total INT;
  _por_evento JSONB;
  _top_rotas JSONB;
  _dau JSONB;
  _por_perfil JSONB;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem consultar métricas de uso'
      USING ERRCODE = '42501';
  END IF;

  _desde := now() - make_interval(days => GREATEST(1, LEAST(_dias, 90)));

  SELECT COUNT(*)::int INTO _total
    FROM public.uso_eventos WHERE created_at >= _desde;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('evento', evento, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
    INTO _por_evento
    FROM (SELECT evento, COUNT(*)::int qtd
            FROM public.uso_eventos WHERE created_at >= _desde
           GROUP BY evento ORDER BY qtd DESC LIMIT 20) e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('rota', rota, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
    INTO _top_rotas
    FROM (SELECT rota, COUNT(*)::int qtd
            FROM public.uso_eventos
           WHERE created_at >= _desde AND rota IS NOT NULL
           GROUP BY rota ORDER BY qtd DESC LIMIT 20) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('dia', dia, 'sessoes', sessoes) ORDER BY dia), '[]'::jsonb)
    INTO _dau
    FROM (SELECT (created_at AT TIME ZONE 'UTC')::date AS dia,
                 COUNT(DISTINCT sessao_hash)::int AS sessoes
            FROM public.uso_eventos WHERE created_at >= _desde
           GROUP BY 1) d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('perfil', perfil_codigo, 'qtd', qtd) ORDER BY qtd DESC), '[]'::jsonb)
    INTO _por_perfil
    FROM (SELECT COALESCE(perfil_codigo, 'SEM_PERFIL') perfil_codigo, COUNT(*)::int qtd
            FROM public.uso_eventos WHERE created_at >= _desde
           GROUP BY 1) p;

  RETURN jsonb_build_object(
    'periodo_dias', GREATEST(1, LEAST(_dias, 90)),
    'total_eventos', _total,
    'por_evento', _por_evento,
    'top_rotas', _top_rotas,
    'dau', _dau,
    'por_perfil', _por_perfil,
    'gerado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.uso_metricas(INT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.uso_metricas(INT) TO authenticated;
