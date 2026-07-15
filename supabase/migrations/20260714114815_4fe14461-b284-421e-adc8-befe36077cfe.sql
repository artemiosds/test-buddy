
-- 1) Descontinuar tabela nova (0 linhas, não usada)
DROP TABLE IF EXISTS public.frequencias_efetivos CASCADE;

-- 2) Novos campos em frequencia_profissional (Efetivos — modelo AGILIBlue/Prefeitura)
ALTER TABLE public.frequencia_profissional
  ADD COLUMN IF NOT EXISTS ferias_terco numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ferias_integral numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sal_sub_h numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aulas_suplementares numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freq_prof_ferias_terco_nonneg') THEN
    ALTER TABLE public.frequencia_profissional ADD CONSTRAINT freq_prof_ferias_terco_nonneg CHECK (ferias_terco >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freq_prof_ferias_integral_nonneg') THEN
    ALTER TABLE public.frequencia_profissional ADD CONSTRAINT freq_prof_ferias_integral_nonneg CHECK (ferias_integral >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freq_prof_sal_sub_h_nonneg') THEN
    ALTER TABLE public.frequencia_profissional ADD CONSTRAINT freq_prof_sal_sub_h_nonneg CHECK (sal_sub_h >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'freq_prof_aulas_supl_nonneg') THEN
    ALTER TABLE public.frequencia_profissional ADD CONSTRAINT freq_prof_aulas_supl_nonneg CHECK (aulas_suplementares >= 0);
  END IF;
END$$;

-- 3) Campos de referência em profissionais (Efetivos)
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS proj numeric,
  ADD COLUMN IF NOT EXISTS h_p numeric,
  ADD COLUMN IF NOT EXISTS c_h numeric,
  ADD COLUMN IF NOT EXISTS jorn numeric;
