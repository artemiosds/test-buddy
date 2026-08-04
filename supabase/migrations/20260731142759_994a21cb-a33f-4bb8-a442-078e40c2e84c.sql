ALTER TABLE public.setores
  ADD COLUMN IF NOT EXISTS cnes varchar(20),
  ADD COLUMN IF NOT EXISTS tipo text,
  ADD COLUMN IF NOT EXISTS cnpj varchar(20),
  ADD COLUMN IF NOT EXISTS endereco text;