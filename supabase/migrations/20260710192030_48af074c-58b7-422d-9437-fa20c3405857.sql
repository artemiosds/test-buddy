
-- 1) Enum de status por linha
DO $$ BEGIN
  CREATE TYPE public.status_linha_frequencia AS ENUM ('pendente','aprovada','rejeitada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novas colunas
ALTER TABLE public.frequencia_profissional
  ADD COLUMN IF NOT EXISTS status_linha public.status_linha_frequencia NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS observacao_analise TEXT,
  ADD COLUMN IF NOT EXISTS analisado_por UUID REFERENCES public.usuarios(id),
  ADD COLUMN IF NOT EXISTS analisado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_freq_prof_status_linha
  ON public.frequencia_profissional(status_linha);

-- 3) Trigger BEFORE UPDATE: só Master ou quem tem permissão de aprovar/rejeitar
--    pode alterar status_linha, observacao_analise, analisado_por, analisado_em.
CREATE OR REPLACE FUNCTION public.tg_freq_prof_guard_analise()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  _uid UUID := auth.uid();
  _mudou BOOLEAN;
  _autorizado BOOLEAN;
BEGIN
  _mudou :=
       NEW.status_linha       IS DISTINCT FROM OLD.status_linha
    OR NEW.observacao_analise IS DISTINCT FROM OLD.observacao_analise
    OR NEW.analisado_por      IS DISTINCT FROM OLD.analisado_por
    OR NEW.analisado_em       IS DISTINCT FROM OLD.analisado_em;

  IF NOT _mudou THEN
    RETURN NEW;
  END IF;

  -- Sem contexto de usuário (jobs internos/service_role) -> permite
  IF _uid IS NULL THEN
    RETURN NEW;
  END IF;

  _autorizado :=
       public.is_master(_uid)
    OR public.has_permission(_uid, 'frequencia.aprovar')
    OR public.has_permission(_uid, 'frequencia.rejeitar');

  IF NOT _autorizado THEN
    RAISE EXCEPTION 'Sem permissão para alterar os campos de análise da linha (status_linha, observacao_analise, analisado_por, analisado_em)'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_freq_prof_guard_analise ON public.frequencia_profissional;
CREATE TRIGGER trg_freq_prof_guard_analise
  BEFORE UPDATE ON public.frequencia_profissional
  FOR EACH ROW EXECUTE FUNCTION public.tg_freq_prof_guard_analise();
