ALTER TABLE public.setores
  ADD COLUMN IF NOT EXISTS gestor_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS observacoes text;

CREATE INDEX IF NOT EXISTS idx_setores_gestor_id
  ON public.setores(gestor_id)
  WHERE gestor_id IS NOT NULL AND deleted_at IS NULL;