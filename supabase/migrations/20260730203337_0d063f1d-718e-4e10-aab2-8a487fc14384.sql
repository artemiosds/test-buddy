ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS modelo_planilha_id uuid REFERENCES public.planilha_modelos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_historico_importacoes_modelo
  ON public.historico_importacoes (modelo_planilha_id);