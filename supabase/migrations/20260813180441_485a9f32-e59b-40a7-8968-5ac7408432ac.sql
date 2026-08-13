ALTER TABLE public.frequencia_profissional
  ALTER COLUMN aulas_suplementares TYPE text
  USING aulas_suplementares::text;