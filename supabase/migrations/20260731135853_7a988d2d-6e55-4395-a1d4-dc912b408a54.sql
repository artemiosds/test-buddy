ALTER TABLE public.piso_enfermagem
  ADD COLUMN IF NOT EXISTS plantao numeric,
  ADD COLUMN IF NOT EXISTS sobreaviso numeric;