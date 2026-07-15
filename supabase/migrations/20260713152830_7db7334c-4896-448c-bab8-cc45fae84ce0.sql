
-- SLA processor for institutional pendencies
CREATE OR REPLACE FUNCTION public.sla_pendencias_processar()
RETURNS TABLE(vencidas INT, proximas INT, escaladas INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r RECORD;
  _vencidas INT := 0;
  _proximas INT := 0;
  _escaladas INT := 0;
  _prazo_ts TIMESTAMPTZ;
  _hoje DATE := (now() AT TIME ZONE 'America/Belem')::date;
  _open public.pendencia_status[] := ARRAY['aberta','em_analise','aguardando_resposta','reaberta','respondida']::public.pendencia_status[];
  _new_prio public.pendencia_prioridade;
BEGIN
  FOR r IN
    SELECT id, numero, titulo, prioridade, status, secretaria_id, unidade_id,
           responsavel_id, prazo, sla_horas, aberta_em, correlation_id
    FROM public.pendencias
    WHERE deleted_at IS NULL
      AND status = ANY(_open)
      AND (
        prazo IS NOT NULL
        OR sla_horas IS NOT NULL
      )
  LOOP
    -- Calcula timestamp de vencimento (prazo tem prioridade sobre sla_horas)
    IF r.prazo IS NOT NULL THEN
      _prazo_ts := (r.prazo + INTERVAL '1 day')::timestamptz; -- fim do dia do prazo
    ELSE
      _prazo_ts := r.aberta_em + make_interval(hours => r.sla_horas);
    END IF;

    IF _prazo_ts <= now() THEN
      -- VENCIDA — idempotência por dia
      PERFORM public.emit_evento(
        'pendencia.prazo_vencido',
        'pendencia',
        r.id::text,
        jsonb_build_object(
          'numero', r.numero,
          'titulo', r.titulo,
          'prazo', r.prazo,
          'sla_horas', r.sla_horas,
          'venceu_em', _prazo_ts
        ),
        jsonb_build_object('origem','sla_job','secretaria_id',r.secretaria_id,'unidade_id',r.unidade_id),
        r.correlation_id, NULL,
        'sla:vencido:' || r.id::text || ':' || _hoje::text,
        1
      );
      _vencidas := _vencidas + 1;

      -- ESCALONAMENTO automático (baixa→media→alta→critica) 1x por dia
      _new_prio := CASE r.prioridade
        WHEN 'baixa'  THEN 'media'::public.pendencia_prioridade
        WHEN 'media'  THEN 'alta'::public.pendencia_prioridade
        WHEN 'alta'   THEN 'critica'::public.pendencia_prioridade
        ELSE NULL
      END;
      IF _new_prio IS NOT NULL THEN
        UPDATE public.pendencias
           SET prioridade = _new_prio, updated_at = now()
         WHERE id = r.id AND prioridade = r.prioridade;

        PERFORM public.emit_evento(
          'pendencia.escalonada',
          'pendencia',
          r.id::text,
          jsonb_build_object('de', r.prioridade, 'para', _new_prio, 'motivo','sla_vencido'),
          jsonb_build_object('origem','sla_job','secretaria_id',r.secretaria_id,'unidade_id',r.unidade_id),
          r.correlation_id, NULL,
          'sla:escalonada:' || r.id::text || ':' || _hoje::text,
          1
        );
        _escaladas := _escaladas + 1;
      END IF;

    ELSIF _prazo_ts <= now() + INTERVAL '24 hours' THEN
      -- PRÓXIMA (T-24h) — idempotência por dia
      PERFORM public.emit_evento(
        'pendencia.prazo_proximo',
        'pendencia',
        r.id::text,
        jsonb_build_object(
          'numero', r.numero,
          'titulo', r.titulo,
          'prazo', r.prazo,
          'sla_horas', r.sla_horas,
          'vence_em', _prazo_ts
        ),
        jsonb_build_object('origem','sla_job','secretaria_id',r.secretaria_id,'unidade_id',r.unidade_id),
        r.correlation_id, NULL,
        'sla:proximo:' || r.id::text || ':' || _hoje::text,
        1
      );
      _proximas := _proximas + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT _vencidas, _proximas, _escaladas;
END;
$$;

REVOKE ALL ON FUNCTION public.sla_pendencias_processar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sla_pendencias_processar() TO service_role;

-- Agendamento: a cada 15 minutos
SELECT cron.unschedule('sla-pendencias-15min') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sla-pendencias-15min'
);

SELECT cron.schedule(
  'sla-pendencias-15min',
  '*/15 * * * *',
  $cron$ SELECT public.sla_pendencias_processar(); $cron$
);
