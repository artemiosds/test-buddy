
CREATE OR REPLACE FUNCTION public.reprocessar_evento_dominio(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _status text;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem reprocessar eventos'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO _status FROM public.eventos_dominio WHERE id = _id;
  IF _status IS NULL THEN
    RAISE EXCEPTION 'Evento % não encontrado', _id USING ERRCODE = '22023';
  END IF;
  IF _status NOT IN ('falhou','falhou_retry','descartado') THEN
    RAISE EXCEPTION 'Evento em status % não é reprocessável', _status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.eventos_dominio
     SET status = 'pendente',
         proxima_tentativa_em = NULL,
         ultimo_erro = NULL,
         worker_id = NULL
   WHERE id = _id;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (_caller, 'custom'::public.operacao_auditoria,
          'public.eventos_dominio', _id::text,
          jsonb_build_object('acao','evento.reprocessar','origem','client','status_anterior',_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.descartar_evento_dominio(_id uuid, _motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _status text;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem descartar eventos'
      USING ERRCODE = '42501';
  END IF;

  SELECT status INTO _status FROM public.eventos_dominio WHERE id = _id;
  IF _status IS NULL THEN
    RAISE EXCEPTION 'Evento % não encontrado', _id USING ERRCODE = '22023';
  END IF;
  IF _status IN ('processado','descartado') THEN
    RAISE EXCEPTION 'Evento em status % não pode ser descartado', _status
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.eventos_dominio
     SET status = 'descartado',
         processado_em = now(),
         proxima_tentativa_em = NULL,
         ultimo_erro = COALESCE(NULLIF(btrim(_motivo), ''), ultimo_erro)
   WHERE id = _id;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (_caller, 'custom'::public.operacao_auditoria,
          'public.eventos_dominio', _id::text,
          jsonb_build_object('acao','evento.descartar','origem','client',
                             'status_anterior',_status,
                             'motivo', NULLIF(btrim(coalesce(_motivo,'')), '')));
END;
$$;

CREATE OR REPLACE FUNCTION public.eventos_travados(_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _rows jsonb;
BEGIN
  IF _caller IS NULL OR NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Apenas usuários Master podem listar eventos travados'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'tipo', tipo, 'agregado', agregado, 'agregado_id', agregado_id,
    'status', status, 'tentativas', tentativas, 'ultimo_erro', ultimo_erro,
    'created_at', created_at, 'updated_at', updated_at,
    'proxima_tentativa_em', proxima_tentativa_em
  ) ORDER BY updated_at DESC), '[]'::jsonb)
  INTO _rows
  FROM (
    SELECT id, tipo, agregado, agregado_id, status, tentativas, ultimo_erro,
           created_at, updated_at, proxima_tentativa_em
      FROM public.eventos_dominio
     WHERE (status = 'falhou_retry' AND tentativas >= 5)
        OR status = 'falhou'
     ORDER BY updated_at DESC
     LIMIT GREATEST(1, LEAST(_limit, 200))
  ) t;

  RETURN jsonb_build_object('rows', _rows, 'gerado_em', now());
END;
$$;

REVOKE ALL ON FUNCTION public.reprocessar_evento_dominio(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.descartar_evento_dominio(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eventos_travados(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reprocessar_evento_dominio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.descartar_evento_dominio(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eventos_travados(integer) TO authenticated;
