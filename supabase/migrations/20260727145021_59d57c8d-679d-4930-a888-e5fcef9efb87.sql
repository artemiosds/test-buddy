CREATE TABLE public.piso_competencia_profissional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  competencia text NOT NULL,
  categoria text,
  -- bloco Piso
  salario_base numeric,
  insalubridade numeric,
  auxilio_financeiro numeric,
  valor_referencia numeric,
  complementacao numeric,
  total_remuneracao numeric,
  -- bloco FOPAG
  tempo_servico numeric,
  hora_extra_50 numeric,
  hora_extra_100 numeric,
  plantao numeric,
  sobreaviso numeric,
  gratificacoes numeric,
  vale_transporte numeric,
  inss numeric,
  irrf numeric,
  total_descontos numeric,
  total_proventos numeric,
  valor_liquido numeric,
  -- controle
  origem_piso boolean NOT NULL DEFAULT false,
  origem_fopag boolean NOT NULL DEFAULT false,
  status_importacao text NOT NULL DEFAULT 'pendente',
  divergencia boolean NOT NULL DEFAULT false,
  divergencia_valor numeric,
  divergencia_detalhe text,
  historico_id_piso uuid REFERENCES public.historico_importacoes(id) ON DELETE SET NULL,
  historico_id_fopag uuid REFERENCES public.historico_importacoes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (profissional_id, competencia)
);

CREATE INDEX idx_pcp_competencia ON public.piso_competencia_profissional (competencia);
CREATE INDEX idx_pcp_profissional ON public.piso_competencia_profissional (profissional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.piso_competencia_profissional TO authenticated;
GRANT ALL ON public.piso_competencia_profissional TO service_role;
ALTER TABLE public.piso_competencia_profissional ENABLE ROW LEVEL SECURITY;

CREATE POLICY pcp_select ON public.piso_competencia_profissional FOR SELECT TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.visualizar'));
CREATE POLICY pcp_insert ON public.piso_competencia_profissional FOR INSERT TO authenticated
  WITH CHECK (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY pcp_update ON public.piso_competencia_profissional FOR UPDATE TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'))
  WITH CHECK (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY pcp_delete ON public.piso_competencia_profissional FOR DELETE TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));

CREATE TRIGGER trg_pcp_updated_at BEFORE UPDATE ON public.piso_competencia_profissional
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.piso_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  competencia text,
  cpf text,
  nome text,
  matricula text,
  cargo text,
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  historico_id uuid REFERENCES public.historico_importacoes(id) ON DELETE CASCADE,
  origem_arquivo text,
  detalhe text,
  resolvida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_piso_pend_competencia ON public.piso_pendencias (competencia);
CREATE INDEX idx_piso_pend_tipo ON public.piso_pendencias (tipo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.piso_pendencias TO authenticated;
GRANT ALL ON public.piso_pendencias TO service_role;
ALTER TABLE public.piso_pendencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY piso_pend_select ON public.piso_pendencias FOR SELECT TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.visualizar'));
CREATE POLICY piso_pend_insert ON public.piso_pendencias FOR INSERT TO authenticated
  WITH CHECK (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY piso_pend_update ON public.piso_pendencias FOR UPDATE TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'))
  WITH CHECK (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY piso_pend_delete ON public.piso_pendencias FOR DELETE TO authenticated
  USING (is_master(auth.uid()) OR has_permission(auth.uid(), 'piso.importar'));

CREATE TRIGGER trg_piso_pend_updated_at BEFORE UPDATE ON public.piso_pendencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS tipo_planilha text,
  ADD COLUMN IF NOT EXISTS registros_atualizados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS registros_pendencias integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duracao_ms integer;