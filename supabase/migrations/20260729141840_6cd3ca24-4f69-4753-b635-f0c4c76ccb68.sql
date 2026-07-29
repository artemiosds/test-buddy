-- Fase 7/8 — métricas MASTER e agentes especializados

ALTER TABLE public.hsm_auditoria
  ADD COLUMN IF NOT EXISTS agente text,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custo_usd numeric(14,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_entrada integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_saida integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS hsm_auditoria_created_at_idx ON public.hsm_auditoria (created_at DESC);

ALTER TABLE public.hsm_conversas
  ADD COLUMN IF NOT EXISTS agente text;

-- Feedback das respostas
CREATE TABLE IF NOT EXISTS public.hsm_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mensagem_id uuid NOT NULL REFERENCES public.hsm_mensagens(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  util boolean NOT NULL,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mensagem_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hsm_feedback TO authenticated;
GRANT ALL ON public.hsm_feedback TO service_role;
ALTER TABLE public.hsm_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hsm_feedback_proprio" ON public.hsm_feedback;
CREATE POLICY "hsm_feedback_proprio" ON public.hsm_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (user_id = auth.uid());

-- Estatísticas gerenciais (somente MASTER)
CREATE OR REPLACE FUNCTION public.hsm_estatisticas(_dias integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _desde timestamptz := now() - (GREATEST(COALESCE(_dias, 30), 1) || ' days')::interval;
  _res jsonb;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas o perfil Master pode consultar as estatísticas do HSM Expert.';
  END IF;

  SELECT jsonb_build_object(
    'dias', GREATEST(COALESCE(_dias, 30), 1),
    'gerado_em', now(),
    'resumo', (
      SELECT jsonb_build_object(
        'eventos', count(*),
        'sucessos', count(*) FILTER (WHERE sucesso),
        'erros', count(*) FILTER (WHERE NOT sucesso),
        'cache_hits', count(*) FILTER (WHERE cache_hit OR acao = 'consulta_cache'),
        'consultas', count(*) FILTER (WHERE acao IN ('consulta','consulta_cache')),
        'tokens', COALESCE(sum(tokens), 0),
        'tokens_entrada', COALESCE(sum(tokens_entrada), 0),
        'tokens_saida', COALESCE(sum(tokens_saida), 0),
        'custo_usd', COALESCE(sum(custo_usd), 0),
        'duracao_media_ms', COALESCE(round(avg(duracao_ms)), 0),
        'usuarios', count(DISTINCT user_id)
      )
      FROM public.hsm_auditoria WHERE created_at >= _desde
    ),
    'por_dia', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'dia')
      FROM (
        SELECT jsonb_build_object(
          'dia', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
          'eventos', count(*),
          'erros', count(*) FILTER (WHERE NOT sucesso),
          'cache_hits', count(*) FILTER (WHERE cache_hit OR acao = 'consulta_cache'),
          'tokens', COALESCE(sum(tokens), 0),
          'custo_usd', COALESCE(sum(custo_usd), 0)
        ) AS x
        FROM public.hsm_auditoria WHERE created_at >= _desde
        GROUP BY date_trunc('day', created_at)
      ) s
    ), '[]'::jsonb),
    'por_modelo', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'eventos')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'modelo', COALESCE(modelo, 'não informado'),
          'provedor', COALESCE(provedor, 'não informado'),
          'eventos', count(*)::int,
          'tokens', COALESCE(sum(tokens), 0),
          'custo_usd', COALESCE(sum(custo_usd), 0)
        ) AS x
        FROM public.hsm_auditoria WHERE created_at >= _desde AND modelo IS NOT NULL
        GROUP BY modelo, provedor
      ) s
    ), '[]'::jsonb),
    'por_ferramenta', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'eventos')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'ferramenta', ferramenta,
          'eventos', count(*)::int,
          'erros', count(*) FILTER (WHERE NOT sucesso)::int,
          'cache_hits', count(*) FILTER (WHERE cache_hit OR acao = 'consulta_cache')::int
        ) AS x
        FROM public.hsm_auditoria WHERE created_at >= _desde AND ferramenta IS NOT NULL
        GROUP BY ferramenta
      ) s
    ), '[]'::jsonb),
    'por_agente', COALESCE((
      SELECT jsonb_agg(x ORDER BY (x->>'eventos')::int DESC)
      FROM (
        SELECT jsonb_build_object(
          'agente', COALESCE(agente, 'geral'),
          'eventos', count(*)::int,
          'erros', count(*) FILTER (WHERE NOT sucesso)::int
        ) AS x
        FROM public.hsm_auditoria WHERE created_at >= _desde
        GROUP BY COALESCE(agente, 'geral')
      ) s
    ), '[]'::jsonb),
    'erros_recentes', COALESCE((
      SELECT jsonb_agg(x)
      FROM (
        SELECT jsonb_build_object(
          'created_at', created_at,
          'ferramenta', ferramenta,
          'modelo', modelo,
          'erro', left(COALESCE(erro, ''), 240)
        ) AS x
        FROM public.hsm_auditoria
        WHERE created_at >= _desde AND NOT sucesso
        ORDER BY created_at DESC LIMIT 20
      ) s
    ), '[]'::jsonb),
    'feedback', (
      SELECT jsonb_build_object(
        'total', count(*),
        'positivos', count(*) FILTER (WHERE util),
        'negativos', count(*) FILTER (WHERE NOT util)
      )
      FROM public.hsm_feedback WHERE created_at >= _desde
    ),
    'feedback_recente', COALESCE((
      SELECT jsonb_agg(x)
      FROM (
        SELECT jsonb_build_object(
          'created_at', created_at,
          'util', util,
          'comentario', left(COALESCE(comentario, ''), 240)
        ) AS x
        FROM public.hsm_feedback
        WHERE created_at >= _desde AND comentario IS NOT NULL AND comentario <> ''
        ORDER BY created_at DESC LIMIT 15
      ) s
    ), '[]'::jsonb)
  ) INTO _res;

  RETURN _res;
END;
$$;

REVOKE ALL ON FUNCTION public.hsm_estatisticas(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.hsm_estatisticas(integer) TO authenticated;