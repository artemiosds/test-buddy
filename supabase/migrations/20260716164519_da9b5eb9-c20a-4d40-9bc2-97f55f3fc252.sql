
-- Cargos: área profissional e exige conselho
ALTER TABLE public.cargos
  ADD COLUMN IF NOT EXISTS area_profissional TEXT,
  ADD COLUMN IF NOT EXISTS exige_conselho BOOLEAN NOT NULL DEFAULT false;

-- Funções: vínculo opcional a cargo
ALTER TABLE public.funcoes
  ADD COLUMN IF NOT EXISTS cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcoes_cargo_id
  ON public.funcoes(cargo_id) WHERE cargo_id IS NOT NULL AND deleted_at IS NULL;
