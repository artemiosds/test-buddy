CREATE TYPE public.status_competencia AS ENUM ('aberta','em_processamento','encerrada','arquivada');
CREATE TYPE public.status_competencia_unidade AS ENUM ('nao_iniciada','em_elaboracao','enviada','em_analise','com_pendencias','aprovada','rejeitada','arquivada');
CREATE TYPE public.tipo_frequencia AS ENUM ('contratados','efetivos');
CREATE TYPE public.status_frequencia AS ENUM ('rascunho','enviada','em_analise','com_pendencias','aprovada','rejeitada','arquivada');
CREATE TYPE public.status_pendencia AS ENUM ('aberta','respondida','resolvida','cancelada');

CREATE TABLE public.competencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  ano INT NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  descricao TEXT, data_inicio DATE NOT NULL, data_fim DATE NOT NULL,
  prazo_envio DATE, prazo_analise DATE,
  status public.status_competencia NOT NULL DEFAULT 'aberta',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  UNIQUE(secretaria_id, ano, mes),
  CHECK (data_fim >= data_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competencias TO authenticated;
GRANT ALL ON public.competencias TO service_role;
ALTER TABLE public.competencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_competencias_secretaria ON public.competencias(secretaria_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_competencias_ano_mes ON public.competencias(ano, mes);
CREATE INDEX idx_competencias_status ON public.competencias(status);
CREATE TRIGGER tg_competencias_updated_at BEFORE UPDATE ON public.competencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_competencias_updated_by BEFORE UPDATE ON public.competencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "competencias_select" ON public.competencias FOR SELECT TO authenticated USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR public.user_has_secretaria(auth.uid(), secretaria_id)));
CREATE POLICY "competencias_insert" ON public.competencias FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'competencia.criar', NULL, secretaria_id));
CREATE POLICY "competencias_update" ON public.competencias FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'competencia.editar', NULL, secretaria_id)) WITH CHECK (public.has_permission(auth.uid(), 'competencia.editar', NULL, secretaria_id));
CREATE POLICY "competencias_delete" ON public.competencias FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

CREATE TABLE public.competencia_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_id UUID NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE RESTRICT,
  status public.status_competencia_unidade NOT NULL DEFAULT 'nao_iniciada',
  responsavel_id UUID REFERENCES public.usuarios(id),
  data_envio TIMESTAMPTZ, data_analise TIMESTAMPTZ, data_aprovacao TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  UNIQUE(competencia_id, unidade_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competencia_unidades TO authenticated;
GRANT ALL ON public.competencia_unidades TO service_role;
ALTER TABLE public.competencia_unidades ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_comp_unid_competencia ON public.competencia_unidades(competencia_id);
CREATE INDEX idx_comp_unid_unidade ON public.competencia_unidades(unidade_id);
CREATE INDEX idx_comp_unid_status ON public.competencia_unidades(status);
CREATE TRIGGER tg_comp_unid_updated_at BEFORE UPDATE ON public.competencia_unidades FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_comp_unid_updated_by BEFORE UPDATE ON public.competencia_unidades FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "comp_unid_select" ON public.competencia_unidades FOR SELECT TO authenticated USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), unidade_id)));
CREATE POLICY "comp_unid_insert" ON public.competencia_unidades FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'competencia.criar', unidade_id, NULL));
CREATE POLICY "comp_unid_update" ON public.competencia_unidades FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'competencia.editar', unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.editar', unidade_id, NULL)) WITH CHECK (public.has_permission(auth.uid(), 'competencia.editar', unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.editar', unidade_id, NULL));
CREATE POLICY "comp_unid_delete" ON public.competencia_unidades FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

CREATE TABLE public.frequencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia_unidade_id UUID NOT NULL REFERENCES public.competencia_unidades(id) ON DELETE CASCADE,
  tipo public.tipo_frequencia NOT NULL,
  status public.status_frequencia NOT NULL DEFAULT 'rascunho',
  total_profissionais INT NOT NULL DEFAULT 0,
  total_dias_trabalhados NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_faltas NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_horas_extras NUMERIC(10,2) NOT NULL DEFAULT 0,
  data_envio TIMESTAMPTZ, enviada_por UUID REFERENCES public.usuarios(id),
  data_aprovacao TIMESTAMPTZ, aprovada_por UUID REFERENCES public.usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  UNIQUE(competencia_unidade_id, tipo)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias TO authenticated;
GRANT ALL ON public.frequencias TO service_role;
ALTER TABLE public.frequencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_frequencias_comp_unid ON public.frequencias(competencia_unidade_id);
CREATE INDEX idx_frequencias_status ON public.frequencias(status);
CREATE INDEX idx_frequencias_tipo ON public.frequencias(tipo);
CREATE TRIGGER tg_frequencias_updated_at BEFORE UPDATE ON public.frequencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_frequencias_updated_by BEFORE UPDATE ON public.frequencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "frequencias_select" ON public.frequencias FOR SELECT TO authenticated USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.competencia_unidades cu WHERE cu.id = competencia_unidade_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))));
CREATE POLICY "frequencias_insert" ON public.frequencias FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.competencia_unidades cu WHERE cu.id = competencia_unidade_id AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)));
CREATE POLICY "frequencias_update" ON public.frequencias FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.competencia_unidades cu WHERE cu.id = competencia_unidade_id AND (public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL)))) WITH CHECK (EXISTS (SELECT 1 FROM public.competencia_unidades cu WHERE cu.id = competencia_unidade_id AND (public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL))));
CREATE POLICY "frequencias_delete" ON public.frequencias FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

CREATE TABLE public.frequencia_profissional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequencia_id UUID NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE RESTRICT,
  cargo_id UUID REFERENCES public.cargos(id),
  funcao_id UUID REFERENCES public.funcoes(id),
  vinculo_id UUID REFERENCES public.vinculos(id),
  carga_horaria_mensal NUMERIC(6,2),
  dias_trabalhados NUMERIC(5,2) NOT NULL DEFAULT 0,
  faltas_justificadas NUMERIC(5,2) NOT NULL DEFAULT 0,
  faltas_injustificadas NUMERIC(5,2) NOT NULL DEFAULT 0,
  ferias NUMERIC(5,2) NOT NULL DEFAULT 0,
  licencas NUMERIC(5,2) NOT NULL DEFAULT 0,
  afastamentos NUMERIC(5,2) NOT NULL DEFAULT 0,
  horas_extras NUMERIC(6,2) NOT NULL DEFAULT 0,
  adicional_noturno NUMERIC(6,2) NOT NULL DEFAULT 0,
  plantoes_extras NUMERIC(5,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  UNIQUE(frequencia_id, profissional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia_profissional TO authenticated;
GRANT ALL ON public.frequencia_profissional TO service_role;
ALTER TABLE public.frequencia_profissional ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_freq_prof_frequencia ON public.frequencia_profissional(frequencia_id);
CREATE INDEX idx_freq_prof_profissional ON public.frequencia_profissional(profissional_id);
CREATE TRIGGER tg_freq_prof_updated_at BEFORE UPDATE ON public.frequencia_profissional FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_freq_prof_updated_by BEFORE UPDATE ON public.frequencia_profissional FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "freq_prof_select" ON public.frequencia_profissional FOR SELECT TO authenticated USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))));
CREATE POLICY "freq_prof_insert" ON public.frequencia_profissional FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)));
CREATE POLICY "freq_prof_update" ON public.frequencia_profissional FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL))) WITH CHECK (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)));
CREATE POLICY "freq_prof_delete" ON public.frequencia_profissional FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)));

CREATE TABLE public.frequencia_pendencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequencia_id UUID NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
  frequencia_profissional_id UUID REFERENCES public.frequencia_profissional(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL, descricao TEXT NOT NULL,
  status public.status_pendencia NOT NULL DEFAULT 'aberta',
  aberta_por UUID REFERENCES public.usuarios(id),
  respondida_por UUID REFERENCES public.usuarios(id),
  resposta TEXT, data_resposta TIMESTAMPTZ,
  resolvida_por UUID REFERENCES public.usuarios(id),
  data_resolucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia_pendencias TO authenticated;
GRANT ALL ON public.frequencia_pendencias TO service_role;
ALTER TABLE public.frequencia_pendencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_freq_pend_frequencia ON public.frequencia_pendencias(frequencia_id);
CREATE INDEX idx_freq_pend_status ON public.frequencia_pendencias(status);
CREATE TRIGGER tg_freq_pend_updated_at BEFORE UPDATE ON public.frequencia_pendencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_freq_pend_updated_by BEFORE UPDATE ON public.frequencia_pendencias FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "freq_pend_select" ON public.frequencia_pendencias FOR SELECT TO authenticated USING (deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))));
CREATE POLICY "freq_pend_insert" ON public.frequencia_pendencias FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL))));
CREATE POLICY "freq_pend_update" ON public.frequencia_pendencias FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL)))) WITH CHECK (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL))));
CREATE POLICY "freq_pend_delete" ON public.frequencia_pendencias FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

CREATE TABLE public.frequencia_aprovacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequencia_id UUID NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
  status_anterior public.status_frequencia,
  status_novo public.status_frequencia NOT NULL,
  acao TEXT NOT NULL, observacoes TEXT,
  executado_por UUID REFERENCES public.usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT ON public.frequencia_aprovacoes TO authenticated;
GRANT ALL ON public.frequencia_aprovacoes TO service_role;
ALTER TABLE public.frequencia_aprovacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_freq_aprov_frequencia ON public.frequencia_aprovacoes(frequencia_id);
CREATE POLICY "freq_aprov_select" ON public.frequencia_aprovacoes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))));
CREATE POLICY "freq_aprov_insert" ON public.frequencia_aprovacoes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.frequencias f JOIN public.competencia_unidades cu ON cu.id=f.competencia_unidade_id WHERE f.id=frequencia_id AND (public.has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.aprovar', cu.unidade_id, NULL) OR public.has_permission(auth.uid(), 'frequencia.enviar', cu.unidade_id, NULL))));

-- Novas permissões (idempotente via NOT EXISTS)
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria, ativa)
SELECT v.codigo, v.nome, v.descricao, v.modulo::public.modulo_sistema, v.categoria::public.categoria_permissao, true
FROM (VALUES
  ('competencia.encerrar','Encerrar competência','Encerrar uma competência','competencia','administracao'),
  ('competencia.reabrir','Reabrir competência','Reabrir uma competência encerrada','competencia','administracao'),
  ('frequencia.enviar','Enviar frequência','Enviar frequência para análise','frequencia','acao'),
  ('frequencia.rejeitar','Rejeitar frequência','Rejeitar frequência enviada','frequencia','aprovacao'),
  ('frequencia.exportar','Exportar frequência','Exportar frequência em PDF/Excel','frequencia','exportacao'),
  ('pendencia.gerenciar','Gerenciar pendências','Abrir, responder e resolver pendências','frequencia','acao')
) AS v(codigo, nome, descricao, modulo, categoria)
WHERE NOT EXISTS (SELECT 1 FROM public.permissoes p WHERE p.codigo = v.codigo AND p.deleted_at IS NULL);

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true FROM public.perfis p, public.permissoes pm
WHERE (
  (p.codigo='MASTER' AND pm.codigo IN ('competencia.encerrar','competencia.reabrir','frequencia.enviar','frequencia.rejeitar','frequencia.exportar','pendencia.gerenciar')) OR
  (p.codigo='GESTOR' AND pm.codigo IN ('competencia.encerrar','competencia.reabrir','frequencia.rejeitar','frequencia.exportar','pendencia.gerenciar')) OR
  (p.codigo='DIRETOR_UNIDADE' AND pm.codigo IN ('frequencia.enviar','frequencia.exportar','pendencia.gerenciar')) OR
  (p.codigo='ADMINISTRATIVO' AND pm.codigo IN ('frequencia.enviar','pendencia.gerenciar'))
)
AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil_id=p.id AND pp.permissao_id=pm.id);