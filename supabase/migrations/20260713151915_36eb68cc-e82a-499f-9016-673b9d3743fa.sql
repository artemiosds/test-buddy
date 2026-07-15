
-- Índice para o worker
CREATE INDEX IF NOT EXISTS idx_eventos_dominio_fila
  ON public.eventos_dominio (status, proxima_tentativa_em NULLS FIRST, created_at)
  WHERE status IN ('pendente','falhou_retry');

-- Claim em lote (SKIP LOCKED para segurança entre workers concorrentes)
CREATE OR REPLACE FUNCTION public.claim_eventos_dominio(_qtd int DEFAULT 20, _worker text DEFAULT NULL)
RETURNS SETOF public.eventos_dominio
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _w text := COALESCE(_worker, 'worker-' || gen_random_uuid()::text);
BEGIN
  RETURN QUERY
  WITH pick AS (
    SELECT id
    FROM public.eventos_dominio
    WHERE status IN ('pendente','falhou_retry')
      AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= now())
    ORDER BY COALESCE(proxima_tentativa_em, created_at), created_at
    LIMIT GREATEST(1, LEAST(_qtd, 100))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.eventos_dominio e
     SET status = 'processando',
         worker_id = _w,
         tentativas = COALESCE(e.tentativas,0) + 1
    FROM pick
   WHERE e.id = pick.id
  RETURNING e.*;
END;
$$;

-- ACK: sucesso
CREATE OR REPLACE FUNCTION public.ack_evento_dominio(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.eventos_dominio
     SET status = 'processado',
         processado_em = now(),
         ultimo_erro = NULL,
         proxima_tentativa_em = NULL
   WHERE id = _id;
$$;

-- NACK: falha com backoff exponencial (base 60s, teto ~1h). Após 10 tentativas => 'falhou'.
CREATE OR REPLACE FUNCTION public.nack_evento_dominio(_id uuid, _erro text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _tent int;
  _delay_s int;
BEGIN
  SELECT tentativas INTO _tent FROM public.eventos_dominio WHERE id = _id;
  IF _tent IS NULL THEN RETURN; END IF;

  IF _tent >= 10 THEN
    UPDATE public.eventos_dominio
       SET status = 'falhou',
           ultimo_erro = _erro,
           processado_em = now()
     WHERE id = _id;
  ELSE
    -- 60 * 2^(tentativas-1), teto de 3600s
    _delay_s := LEAST(3600, 60 * (2 ^ GREATEST(_tent-1, 0))::int);
    UPDATE public.eventos_dominio
       SET status = 'falhou_retry',
           ultimo_erro = _erro,
           proxima_tentativa_em = now() + make_interval(secs => _delay_s)
     WHERE id = _id;
  END IF;
END;
$$;

-- Ajusta trigger de imutabilidade para permitir também worker_id e proxima_tentativa_em
CREATE OR REPLACE FUNCTION public.tg_eventos_dominio_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.agregado IS DISTINCT FROM OLD.agregado
     OR NEW.agregado_id IS DISTINCT FROM OLD.agregado_id
     OR NEW.dados IS DISTINCT FROM OLD.dados
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
     OR NEW.correlation_id IS DISTINCT FROM OLD.correlation_id
     OR NEW.causation_id IS DISTINCT FROM OLD.causation_id
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.versao_evento IS DISTINCT FROM OLD.versao_evento
     OR NEW.emitido_por IS DISTINCT FROM OLD.emitido_por
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Eventos de domínio são imutáveis: apenas campos técnicos (status, tentativas, ultimo_erro, processado_em, worker_id, proxima_tentativa_em) podem ser alterados.'
      USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Execução restrita ao service_role
REVOKE EXECUTE ON FUNCTION public.claim_eventos_dominio(int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ack_evento_dominio(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nack_evento_dominio(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_eventos_dominio(int, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ack_evento_dominio(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.nack_evento_dominio(uuid, text) TO service_role;
