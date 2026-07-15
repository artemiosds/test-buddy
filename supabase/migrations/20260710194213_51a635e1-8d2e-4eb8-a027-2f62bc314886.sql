
ALTER TABLE public.frequencia_profissional
  ADD COLUMN IF NOT EXISTS atestado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS he_50 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS he_100 numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sobreaviso numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentivo numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS licenca_premio numeric NOT NULL DEFAULT 0;

-- Migrar valores antigos de horas_extras para he_50 (única migration em que isso é feito).
-- CHANGELOG: he_100 fica em zero — a divisão entre HE 50% e HE 100% não é inferível automaticamente.
-- O RH deve conferir manualmente competências anteriores e ajustar he_100 se necessário.
UPDATE public.frequencia_profissional
SET he_50 = COALESCE(horas_extras, 0)
WHERE he_50 = 0 AND COALESCE(horas_extras, 0) <> 0;

ALTER TABLE public.competencias
  ADD COLUMN IF NOT EXISTS motivo_reabertura text;
