ALTER TABLE public.piso_competencia_profissional
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS matricula text,
  ADD COLUMN IF NOT EXISTS cargo_id uuid,
  ADD COLUMN IF NOT EXISTS cargo_nome text,
  ADD COLUMN IF NOT EXISTS unidade_id uuid,
  ADD COLUMN IF NOT EXISTS unidade_nome text,
  ADD COLUMN IF NOT EXISTS setor_id uuid,
  ADD COLUMN IF NOT EXISTS setor_nome text,
  ADD COLUMN IF NOT EXISTS vinculo_id uuid,
  ADD COLUMN IF NOT EXISTS vinculo_nome text,
  ADD COLUMN IF NOT EXISTS situacao_funcional text,
  ADD COLUMN IF NOT EXISTS carga_horaria_semanal numeric,
  ADD COLUMN IF NOT EXISTS status_consolidacao text NOT NULL DEFAULT 'sem_importacao',
  ADD COLUMN IF NOT EXISTS consolidado_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_folha_arquivo text,
  ADD COLUMN IF NOT EXISTS origem_folha_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_folha_usuario uuid,
  ADD COLUMN IF NOT EXISTS origem_folha_layout text,
  ADD COLUMN IF NOT EXISTS origem_piso_arquivo text,
  ADD COLUMN IF NOT EXISTS origem_piso_em timestamptz,
  ADD COLUMN IF NOT EXISTS origem_piso_usuario uuid,
  ADD COLUMN IF NOT EXISTS origem_piso_layout text,
  ADD COLUMN IF NOT EXISTS inconsistencias jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pcp_competencia_status
  ON public.piso_competencia_profissional (competencia, status_consolidacao);
CREATE INDEX IF NOT EXISTS idx_pcp_cpf
  ON public.piso_competencia_profissional (cpf);
CREATE INDEX IF NOT EXISTS idx_pcp_unidade
  ON public.piso_competencia_profissional (unidade_id);