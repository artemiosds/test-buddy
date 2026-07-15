
-- 1) Colunas novas
ALTER TABLE public.eventos_dominio
  ADD COLUMN IF NOT EXISTS versao_evento    INT          NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS correlation_id   UUID,
  ADD COLUMN IF NOT EXISTS causation_id     UUID,
  ADD COLUMN IF NOT EXISTS idempotency_key  TEXT,
  ADD COLUMN IF NOT EXISTS status           TEXT         NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS tentativas       INT          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_erro      TEXT,
  ADD COLUMN IF NOT EXISTS processado_em    TIMESTAMPTZ;

ALTER TABLE public.eventos_dominio
  DROP CONSTRAINT IF EXISTS eventos_dominio_status_check;
ALTER TABLE public.eventos_dominio
  ADD CONSTRAINT eventos_dominio_status_check
  CHECK (status IN ('pendente','processando','processado','erro'));

-- Backfill correlation_id para linhas antigas (auto-correlação)
UPDATE public.eventos_dominio SET correlation_id = id WHERE correlation_id IS NULL;
ALTER TABLE public.eventos_dominio ALTER COLUMN correlation_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS eventos_dominio_idempotency_uniq
  ON public.eventos_dominio (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS eventos_dominio_correlation_idx ON public.eventos_dominio (correlation_id);
CREATE INDEX IF NOT EXISTS eventos_dominio_status_idx ON public.eventos_dominio (status);

-- 2) Bloqueio de INSERT direto — somente service_role pode gravar; app usa a função.
REVOKE INSERT ON public.eventos_dominio FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.eventos_dominio TO authenticated;
GRANT ALL    ON public.eventos_dominio TO service_role;

DROP POLICY IF EXISTS eventos_dominio_insert ON public.eventos_dominio;
-- Sem policy de INSERT: nenhuma sessão authenticated consegue inserir direto.

-- 3) emit_evento como ÚNICA porta de entrada (SECURITY DEFINER + assinatura ampliada)
DROP FUNCTION IF EXISTS public.emit_evento(text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.emit_evento(text, text, text, jsonb, jsonb, uuid, uuid, text, int);

CREATE OR REPLACE FUNCTION public.emit_evento(
  _tipo             TEXT,
  _agregado         TEXT,
  _agregado_id      TEXT,
  _dados            JSONB DEFAULT '{}'::jsonb,
  _metadata         JSONB DEFAULT '{}'::jsonb,
  _correlation_id   UUID  DEFAULT NULL,
  _causation_id     UUID  DEFAULT NULL,
  _idempotency_key  TEXT  DEFAULT NULL,
  _versao           INT   DEFAULT 1
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _new_id UUID := gen_random_uuid();
  _corr   UUID := COALESCE(_correlation_id, _new_id);
  _existing UUID;
BEGIN
  IF _tipo IS NULL OR _agregado IS NULL THEN
    RAISE EXCEPTION 'emit_evento: tipo e agregado são obrigatórios';
  END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO _existing FROM public.eventos_dominio
      WHERE idempotency_key = _idempotency_key LIMIT 1;
    IF _existing IS NOT NULL THEN
      RETURN _existing;
    END IF;
  END IF;

  INSERT INTO public.eventos_dominio(
    id, tipo, agregado, agregado_id, dados, metadata,
    correlation_id, causation_id, idempotency_key,
    versao_evento, status, emitido_por
  ) VALUES (
    _new_id, _tipo, _agregado, _agregado_id,
    COALESCE(_dados,'{}'::jsonb), COALESCE(_metadata,'{}'::jsonb),
    _corr, _causation_id, _idempotency_key,
    COALESCE(_versao,1), 'pendente', auth.uid()
  );
  RETURN _new_id;
EXCEPTION WHEN unique_violation THEN
  -- corrida idempotency_key
  SELECT id INTO _existing FROM public.eventos_dominio
    WHERE idempotency_key = _idempotency_key LIMIT 1;
  RETURN _existing;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_evento(text,text,text,jsonb,jsonb,uuid,uuid,text,int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_evento(text,text,text,jsonb,jsonb,uuid,uuid,text,int) TO authenticated, service_role;
