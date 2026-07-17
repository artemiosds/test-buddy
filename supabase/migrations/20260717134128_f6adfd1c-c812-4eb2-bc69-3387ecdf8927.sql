-- MASTER-only health RPCs for /saude dashboard

CREATE OR REPLACE FUNCTION public.health_eventos_dominio()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _by_status jsonb;
  _oldest_pendente timestamptz;
  _retry_alto int;
  _top_falhas jsonb;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem consultar a saúde do sistema'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_object_agg(status, qtd), '{}'::jsonb)
    INTO _by_status
    FROM (SELECT status, COUNT(*)::int AS qtd
            FROM public.eventos_dominio
           GROUP BY status) s;

  SELECT MIN(created_at) INTO _oldest_pendente
    FROM public.eventos_dominio
   WHERE status IN ('pendente', 'falhou_retry');

  SELECT COUNT(*)::int INTO _retry_alto
    FROM public.eventos_dominio
   WHERE status = 'falhou_retry' AND tentativas >= 5;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'tipo', tipo, 'agregado', agregado,
           'qtd', qtd, 'ultimo_erro', ultimo_erro
         ) ORDER BY qtd DESC), '[]'::jsonb)
    INTO _top_falhas
    FROM (
      SELECT tipo, agregado, COUNT(*)::int AS qtd,
             (ARRAY_AGG(ultimo_erro ORDER BY updated_at DESC))[1] AS ultimo_erro
        FROM public.eventos_dominio
       WHERE status IN ('falhou', 'falhou_retry')
       GROUP BY tipo, agregado
       ORDER BY qtd DESC
       LIMIT 5
    ) t;

  RETURN jsonb_build_object(
    'por_status', _by_status,
    'mais_antigo_pendente', _oldest_pendente,
    'retry_alto', _retry_alto,
    'top_falhas', _top_falhas,
    'gerado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.health_eventos_dominio() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_eventos_dominio() TO authenticated;

CREATE OR REPLACE FUNCTION public.health_pendencias_sla()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _abertas int;
  _vencidas int;
  _proximas int;
  _por_prioridade jsonb;
  _open public.pendencia_status[] :=
    ARRAY['aberta','em_analise','aguardando_resposta','reaberta','respondida']::public.pendencia_status[];
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem consultar a saúde do sistema'
      USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::int INTO _abertas
    FROM public.pendencias
   WHERE deleted_at IS NULL AND status = ANY(_open);

  SELECT COUNT(*)::int INTO _vencidas
    FROM public.pendencias
   WHERE deleted_at IS NULL AND status = ANY(_open)
     AND (
       (prazo IS NOT NULL AND (prazo + INTERVAL '1 day')::timestamptz <= now())
       OR (prazo IS NULL AND sla_horas IS NOT NULL
           AND aberta_em + make_interval(hours => sla_horas) <= now())
     );

  SELECT COUNT(*)::int INTO _proximas
    FROM public.pendencias
   WHERE deleted_at IS NULL AND status = ANY(_open)
     AND (
       (prazo IS NOT NULL
         AND (prazo + INTERVAL '1 day')::timestamptz > now()
         AND (prazo + INTERVAL '1 day')::timestamptz <= now() + INTERVAL '24 hours')
       OR (prazo IS NULL AND sla_horas IS NOT NULL
           AND aberta_em + make_interval(hours => sla_horas) > now()
           AND aberta_em + make_interval(hours => sla_horas) <= now() + INTERVAL '24 hours')
     );

  SELECT COALESCE(jsonb_object_agg(prioridade, qtd), '{}'::jsonb)
    INTO _por_prioridade
    FROM (SELECT prioridade::text AS prioridade, COUNT(*)::int AS qtd
            FROM public.pendencias
           WHERE deleted_at IS NULL AND status = ANY(_open)
           GROUP BY prioridade) p;

  RETURN jsonb_build_object(
    'abertas', _abertas,
    'vencidas', _vencidas,
    'proximas_24h', _proximas,
    'por_prioridade', _por_prioridade,
    'gerado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.health_pendencias_sla() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_pendencias_sla() TO authenticated;

CREATE OR REPLACE FUNCTION public.health_cron_jobs()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _jobs jsonb;
  _falhas jsonb;
  _has_cron boolean;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem consultar a saúde do sistema'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'cron'
  ) INTO _has_cron;

  IF NOT _has_cron THEN
    RETURN jsonb_build_object(
      'disponivel', false,
      'jobs', '[]'::jsonb,
      'falhas_24h', '[]'::jsonb,
      'gerado_em', now()
    );
  END IF;

  EXECUTE $sql$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'jobid', jobid, 'jobname', jobname, 'schedule', schedule, 'active', active
           ) ORDER BY jobname), '[]'::jsonb)
      FROM cron.job
  $sql$ INTO _jobs;

  EXECUTE $sql$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'jobid', jrd.jobid,
             'jobname', j.jobname,
             'status', jrd.status,
             'start_time', jrd.start_time,
             'end_time', jrd.end_time,
             'return_message', jrd.return_message
           ) ORDER BY jrd.start_time DESC), '[]'::jsonb)
      FROM cron.job_run_details jrd
      LEFT JOIN cron.job j ON j.jobid = jrd.jobid
     WHERE jrd.status <> 'succeeded'
       AND jrd.start_time >= now() - INTERVAL '24 hours'
     LIMIT 20
  $sql$ INTO _falhas;

  RETURN jsonb_build_object(
    'disponivel', true,
    'jobs', COALESCE(_jobs, '[]'::jsonb),
    'falhas_24h', COALESCE(_falhas, '[]'::jsonb),
    'gerado_em', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.health_cron_jobs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.health_cron_jobs() TO authenticated;