-- Otimização de Performance para HSM Expert (Tools e Analytics) - V2 (Corrigido)

-- Índices em Profissionais
CREATE INDEX IF NOT EXISTS idx_profissionais_unidade_id ON public.profissionais(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profissionais_status ON public.profissionais(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_profissionais_cpf ON public.profissionais(cpf) WHERE deleted_at IS NULL;

-- Índices em Frequências (Tabela frequencias não tem unidade_id direta, geralmente via profissional_historico ou similar, mas vamos focar no que existe)
-- A tabela frequencias tem status.
CREATE INDEX IF NOT EXISTS idx_frequencias_status ON public.frequencias(status) WHERE deleted_at IS NULL;

-- Índices em Pendências
CREATE INDEX IF NOT EXISTS idx_pendencias_unidade_id ON public.pendencias(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON public.pendencias(status) WHERE deleted_at IS NULL;

-- Índices em Piso Enfermagem (Consolidação)
CREATE INDEX IF NOT EXISTS idx_piso_competencia_unidade ON public.piso_competencia_profissional(competencia, unidade_id);
CREATE INDEX IF NOT EXISTS idx_piso_divergencia ON public.piso_competencia_profissional(divergencia);

-- Auditoria (Chat)
CREATE INDEX IF NOT EXISTS idx_hsm_mensagens_conversa_id ON public.hsm_mensagens(conversa_id);

ANALYZE public.profissionais;
ANALYZE public.frequencias;
ANALYZE public.pendencias;
ANALYZE public.piso_competencia_profissional;
