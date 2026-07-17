
-- Pendências: SLA hot path e listagem
CREATE INDEX IF NOT EXISTS ix_pendencias_status_prazo
  ON public.pendencias (status, prazo)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pendencias_status_sla_aberta
  ON public.pendencias (status, sla_horas, aberta_em)
  WHERE deleted_at IS NULL AND sla_horas IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_pendencias_aberta_em
  ON public.pendencias (aberta_em DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_pendencias_prioridade
  ON public.pendencias (prioridade, status)
  WHERE deleted_at IS NULL;

-- Profissionais: listagens ativas
CREATE INDEX IF NOT EXISTS ix_profissionais_status_ativos
  ON public.profissionais (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_profissionais_unidade_ativos
  ON public.profissionais (unidade_id, status)
  WHERE deleted_at IS NULL;

-- Audit log: ordenação global e filtro por operação
CREATE INDEX IF NOT EXISTS ix_audit_log_ocorrido_em
  ON public.audit_log (ocorrido_em DESC);

CREATE INDEX IF NOT EXISTS ix_audit_log_operacao
  ON public.audit_log (operacao, ocorrido_em DESC);

-- Frequências: filtros compostos com soft-delete
CREATE INDEX IF NOT EXISTS ix_frequencias_status_ativas
  ON public.frequencias (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_frequencias_created_at
  ON public.frequencias (created_at DESC)
  WHERE deleted_at IS NULL;

-- Frequência profissional: join hot path
CREATE INDEX IF NOT EXISTS ix_freq_prof_profissional_ativos
  ON public.frequencia_profissional (profissional_id)
  WHERE deleted_at IS NULL;

-- Eventos de domínio: listagem de eventos travados (ordenada por updated_at)
CREATE INDEX IF NOT EXISTS ix_eventos_dominio_travados
  ON public.eventos_dominio (updated_at DESC)
  WHERE status IN ('falhou', 'falhou_retry');

-- Atualiza estatísticas para o planner considerar os novos índices
ANALYZE public.pendencias;
ANALYZE public.profissionais;
ANALYZE public.audit_log;
ANALYZE public.frequencias;
ANALYZE public.frequencia_profissional;
ANALYZE public.eventos_dominio;
