ALTER TABLE public.frequencia_profissional
  ADD COLUMN IF NOT EXISTS aprovada_por uuid REFERENCES public.usuarios(id);

CREATE INDEX IF NOT EXISTS idx_freq_prof_aprovada_por ON public.frequencia_profissional(aprovada_por);