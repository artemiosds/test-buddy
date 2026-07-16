ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS tipo_atendimento text,
  ADD COLUMN IF NOT EXISTS municipio text,
  ADD COLUMN IF NOT EXISTS distrito text;

CREATE INDEX IF NOT EXISTS idx_unidades_distrito
  ON public.unidades(distrito)
  WHERE distrito IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_unidades_municipio
  ON public.unidades(municipio)
  WHERE municipio IS NOT NULL AND deleted_at IS NULL;