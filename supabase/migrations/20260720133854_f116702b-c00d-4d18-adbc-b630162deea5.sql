-- Adiciona valor de enum ANTES de qualquer uso
ALTER TYPE public.modulo_sistema ADD VALUE IF NOT EXISTS 'piso';

COMMIT;

-- historico_importacoes
CREATE TABLE public.historico_importacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo TEXT NOT NULL CHECK (modelo IN ('Efetivos','Contratados','Ministério','Personalizado')),
  nome_arquivo TEXT NOT NULL,
  tipo_arquivo TEXT NOT NULL CHECK (tipo_arquivo IN ('PDF','Excel','CSV')),
  competencia TEXT,
  total_registros INTEGER NOT NULL DEFAULT 0,
  registros_importados INTEGER NOT NULL DEFAULT 0,
  registros_divergentes INTEGER NOT NULL DEFAULT 0,
  registros_nao_encontrados INTEGER NOT NULL DEFAULT 0,
  data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Concluído' CHECK (status IN ('Concluído','Com erros','Desfeito')),
  mapeamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_importacoes TO authenticated;
GRANT ALL ON public.historico_importacoes TO service_role;
ALTER TABLE public.historico_importacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "piso_hist_select" ON public.historico_importacoes FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.visualizar'));
CREATE POLICY "piso_hist_insert" ON public.historico_importacoes FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_hist_update" ON public.historico_importacoes FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'))
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_hist_delete" ON public.historico_importacoes FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE TRIGGER trg_hist_import_updated BEFORE UPDATE ON public.historico_importacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_hist_import_data ON public.historico_importacoes (data_importacao DESC);
CREATE INDEX idx_hist_import_modelo ON public.historico_importacoes (modelo);

-- piso_enfermagem
CREATE TABLE public.piso_enfermagem (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  historico_id UUID NOT NULL REFERENCES public.historico_importacoes(id) ON DELETE CASCADE,
  profissional_id UUID REFERENCES public.profissionais(id) ON DELETE SET NULL,
  cpf TEXT,
  nome TEXT,
  matricula TEXT,
  cargo TEXT,
  unidade TEXT,
  setor TEXT,
  vinculo TEXT,
  salario_base NUMERIC(14,2),
  piso_complementacao NUMERIC(14,2),
  insalubridade NUMERIC(14,2),
  gratificacao NUMERIC(14,2),
  hora_extra_50 NUMERIC(14,2),
  hora_extra_100 NUMERIC(14,2),
  adicional_noturno NUMERIC(14,2),
  auxilio_financeiro NUMERIC(14,2),
  ferias_1_3 NUMERIC(14,2),
  ferias NUMERIC(14,2),
  inss NUMERIC(14,2),
  irrf NUMERIC(14,2),
  valor_liquido NUMERIC(14,2),
  valor_final NUMERIC(14,2),
  competencia TEXT,
  origem_arquivo TEXT,
  data_importacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status_match TEXT NOT NULL DEFAULT 'nao_localizado' CHECK (status_match IN ('cpf','matricula','nome','nao_localizado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piso_enfermagem TO authenticated;
GRANT ALL ON public.piso_enfermagem TO service_role;
ALTER TABLE public.piso_enfermagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "piso_ln_select" ON public.piso_enfermagem FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.visualizar'));
CREATE POLICY "piso_ln_insert" ON public.piso_enfermagem FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_ln_update" ON public.piso_enfermagem FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'))
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_ln_delete" ON public.piso_enfermagem FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE TRIGGER trg_piso_updated BEFORE UPDATE ON public.piso_enfermagem
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX idx_piso_historico ON public.piso_enfermagem (historico_id);
CREATE INDEX idx_piso_profissional ON public.piso_enfermagem (profissional_id);
CREATE INDEX idx_piso_competencia ON public.piso_enfermagem (competencia);
CREATE INDEX idx_piso_cpf ON public.piso_enfermagem (cpf);

-- piso_mapeamentos_salvos
CREATE TABLE public.piso_mapeamentos_salvos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  modelo TEXT NOT NULL CHECK (modelo IN ('Efetivos','Contratados','Ministério','Personalizado')),
  mapeamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (modelo, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.piso_mapeamentos_salvos TO authenticated;
GRANT ALL ON public.piso_mapeamentos_salvos TO service_role;
ALTER TABLE public.piso_mapeamentos_salvos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "piso_map_select" ON public.piso_mapeamentos_salvos FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.visualizar') OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_map_insert" ON public.piso_mapeamentos_salvos FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_map_update" ON public.piso_mapeamentos_salvos FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'))
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE POLICY "piso_map_delete" ON public.piso_mapeamentos_salvos FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));
CREATE TRIGGER trg_piso_map_updated BEFORE UPDATE ON public.piso_mapeamentos_salvos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Permissões novas
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria, ativa, is_sistema)
VALUES
  ('piso.visualizar', 'Piso Enfermagem — Visualizar', 'Visualizar importações e linhas do módulo Piso Nacional da Enfermagem', 'piso'::public.modulo_sistema, 'visualizacao'::public.categoria_permissao, true, true),
  ('piso.importar',   'Piso Enfermagem — Importar',   'Executar importações e salvar mapeamentos do módulo Piso Nacional da Enfermagem', 'piso'::public.modulo_sistema, 'acao'::public.categoria_permissao, true, true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, per.id, true
FROM public.perfis p
CROSS JOIN public.permissoes per
WHERE p.codigo = 'MASTER'
  AND per.codigo IN ('piso.visualizar','piso.importar')
ON CONFLICT DO NOTHING;

-- Auditoria row-level
CREATE TRIGGER trg_hist_import_audit AFTER INSERT OR UPDATE OR DELETE ON public.historico_importacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER trg_piso_audit AFTER INSERT OR UPDATE OR DELETE ON public.piso_enfermagem
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
