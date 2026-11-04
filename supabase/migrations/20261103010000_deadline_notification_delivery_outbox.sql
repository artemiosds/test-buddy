-- Outbox idempotente para entregas por evento, canal e destinatário.
-- A tabela em public tem RLS habilitado e acesso exclusivo de service_role.

CREATE TABLE IF NOT EXISTS public.notificacao_evento_entregas (
  evento_id text NOT NULL,
  canal text NOT NULL CHECK (canal IN ('in_app', 'email')),
  destinatario text NOT NULL,
  status text NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'enviado', 'falhou')),
  tentativas integer NOT NULL DEFAULT 1 CHECK (tentativas >= 0),
  payload jsonb,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  entregue_em timestamptz,
  CONSTRAINT notificacao_evento_entregas_pkey PRIMARY KEY (evento_id, canal, destinatario)
);

CREATE INDEX IF NOT EXISTS idx_notificacao_evento_entregas_pendentes
  ON public.notificacao_evento_entregas (canal, status, atualizado_em)
  WHERE status IN ('processando', 'falhou');

ALTER TABLE public.notificacao_evento_entregas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notificacao_evento_entregas FROM PUBLIC;
REVOKE ALL ON TABLE public.notificacao_evento_entregas FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notificacao_evento_entregas TO service_role;

CREATE OR REPLACE FUNCTION public.claim_notificacao_evento_entrega(
  p_evento_id text,
  p_canal text,
  p_destinatario text,
  p_payload jsonb DEFAULT NULL,
  p_lease_segundos integer DEFAULT 900
)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_reservada boolean := false;
BEGIN
  IF nullif(btrim(p_evento_id), '') IS NULL
    OR nullif(btrim(p_destinatario), '') IS NULL THEN
    RAISE EXCEPTION 'evento_id e destinatario são obrigatórios'
      USING ERRCODE = '22023';
  END IF;

  IF p_canal NOT IN ('in_app', 'email') THEN
    RAISE EXCEPTION 'canal de entrega inválido'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'payload deve ser um objeto JSON'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notificacao_evento_entregas (
    evento_id, canal, destinatario, status, tentativas, payload, criado_em, atualizado_em
  )
  VALUES (
    p_evento_id, p_canal, p_destinatario, 'processando', 1, p_payload, now(), now()
  )
  ON CONFLICT (evento_id, canal, destinatario) DO NOTHING;

  IF FOUND THEN
    RETURN true;
  END IF;

  UPDATE public.notificacao_evento_entregas
  SET
    status = 'processando',
    tentativas = tentativas + 1,
    payload = coalesce(p_payload, payload),
    erro = NULL,
    atualizado_em = now(),
    entregue_em = NULL
  WHERE evento_id = p_evento_id
    AND canal = p_canal
    AND destinatario = p_destinatario
    AND (
      status = 'falhou'
      OR (
        status = 'processando'
        AND atualizado_em <= now() - make_interval(
          secs => greatest(coalesce(p_lease_segundos, 900), 60)
        )
      )
    )
  RETURNING true INTO v_reservada;

  RETURN coalesce(v_reservada, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_notificacao_evento_entrega(text, text, text, jsonb, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notificacao_evento_entrega(text, text, text, jsonb, integer)
  TO service_role;
