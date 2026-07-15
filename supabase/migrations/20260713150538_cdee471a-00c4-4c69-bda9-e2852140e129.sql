-- Refinamento final do barramento de Eventos de Domínio: colunas de fila, imutabilidade e índices de trabalho

-- 1) Novas colunas para preparação de filas / workers
ALTER TABLE public.eventos_dominio
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2) Índices adicionais para leitura por filas / observabilidade
CREATE INDEX IF NOT EXISTS eventos_dominio_fila_idx
  ON public.eventos_dominio (status, proxima_tentativa_em)
  WHERE status IN ('pendente','erro');

CREATE INDEX IF NOT EXISTS eventos_dominio_worker_idx
  ON public.eventos_dominio (worker_id, status)
  WHERE worker_id IS NOT NULL;

-- 3) Trigger de imutabilidade — apenas campos técnicos podem ser alterados após gravação
CREATE OR REPLACE FUNCTION public.tg_eventos_dominio_imutavel()
RETURNS TRIGGER
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

DROP TRIGGER IF EXISTS eventos_dominio_imutavel ON public.eventos_dominio;
CREATE TRIGGER eventos_dominio_imutavel
  BEFORE UPDATE ON public.eventos_dominio
  FOR EACH ROW EXECUTE FUNCTION public.tg_eventos_dominio_imutavel();

-- 4) Bloqueio explícito de DELETE (mesmo para service_role via política)
CREATE OR REPLACE FUNCTION public.tg_eventos_dominio_no_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Eventos de domínio não podem ser excluídos (append-only).'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS eventos_dominio_no_delete ON public.eventos_dominio;
CREATE TRIGGER eventos_dominio_no_delete
  BEFORE DELETE ON public.eventos_dominio
  FOR EACH ROW EXECUTE FUNCTION public.tg_eventos_dominio_no_delete();

-- 5) Garantir que anon/authenticated não têm privilégios diretos (redundante, mas explícito)
REVOKE ALL ON public.eventos_dominio FROM anon, authenticated;