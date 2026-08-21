-- Otimização de Performance para HSM Expert (Tools e Analytics)
-- Índices nos campos de filtro mais comuns para reduzir latência de consulta.

-- Índices em Profissionais
CREATE INDEX IF NOT EXISTS idx_profissionais_unidade_id ON public.profissionais(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profissionais_status ON public.profissionais(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profissionais_cpf ON public.profissionais(cpf) WHERE deleted_at IS NULL;

-- Índices em Frequências
CREATE INDEX IF NOT EXISTS idx_frequencias_unidade_id ON public.frequencias(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frequencias_competencia ON public.frequencias(competencia) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_frequencias_status ON public.frequencias(status) WHERE deleted_at IS NULL;

-- Índices em Pendências
CREATE INDEX IF NOT EXISTS idx_pendencias_unidade_id ON public.pendencias(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON public.pendencias(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pendencias_prioridade ON public.pendencias(prioridade) WHERE deleted_at IS NULL;

-- Índices em Piso Enfermagem (Consolidação)
CREATE INDEX IF NOT EXISTS idx_piso_competencia_unidade ON public.piso_competencia_profissional(competencia, unidade_id);
CREATE INDEX IF NOT EXISTS idx_piso_divergencia ON public.piso_competencia_profissional(divergencia);

-- Auditoria (Chat)
CREATE INDEX IF NOT EXISTS idx_hsm_mensagens_conversa_id ON public.hsm_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_hsm_conversas_user_id ON public.hsm_conversas(user_id) WHERE arquivada = false;

ANALYZE public.profissionais;
ANALYZE public.frequencias;
ANALYZE public.pendencias;
ANALYZE public.piso_competencia_profissional;
