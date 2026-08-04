ALTER TABLE public.piso_enfermagem
  ADD COLUMN IF NOT EXISTS dias_trabalhados numeric,
  ADD COLUMN IF NOT EXISTS iss numeric,
  ADD COLUMN IF NOT EXISTS total_liquido_base numeric,
  ADD COLUMN IF NOT EXISTS gratificacao_incentivo numeric,
  ADD COLUMN IF NOT EXISTS auxilio_transporte numeric,
  ADD COLUMN IF NOT EXISTS incentivo numeric,
  ADD COLUMN IF NOT EXISTS conta_bancaria text,
  ADD COLUMN IF NOT EXISTS dados_origem jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.piso_enfermagem.dados_origem IS 'Linha processada completa da importação, preservada para reprodução fiel do arquivo de origem e do modelo aplicado.';