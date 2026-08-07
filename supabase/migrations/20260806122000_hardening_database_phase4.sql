-- FASE 4 — HARDENING DE BANCO DE DADOS
-- Objetivo: Otimizar performance, garantir integridade e fortalecer segurança.

-- 1. ÍNDICES ADICIONAIS PARA CONSULTAS CRÍTICAS
-- Profissionais: Busca por CPF exato (normalizado) é o gargalo principal da sincronização
CREATE INDEX IF NOT EXISTS ix_profissionais_cpf_exact ON public.profissionais (cpf) WHERE deleted_at IS NOT NULL;
-- Piso: Busca por competência + status para dashboards
CREATE INDEX IF NOT EXISTS ix_pcp_competencia_status ON public.piso_competencia_profissional (competencia, status_consolidacao);

-- 2. MATERIALIZED VIEWS PARA DASHBOARDS (Performance)
-- Evita recalcular o resumo do Piso em tempo real se a base for muito grande.
-- O refresh deve ser feito via trigger ou worker após consolidação.
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_piso_resumo_competencia AS
SELECT 
    competencia,
    status_consolidacao,
    COUNT(*) as total,
    SUM(valor_referencia) as total_referencia,
    SUM(complementacao) as total_complementacao
FROM public.piso_competencia_profissional
GROUP BY competencia, status_consolidacao;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_piso_resumo_ref ON public.mv_piso_resumo_competencia (competencia, status_consolidacao);

-- 3. CONSTRAINTS DE INTEGRIDADE
-- Garante que valores financeiros nunca sejam negativos
ALTER TABLE public.piso_competencia_profissional 
ADD CONSTRAINT pcp_valores_positivos 
CHECK (salario_base >= 0 AND insalubridade >= 0 AND complementacao >= 0);

-- 4. VACUUM E ANALYZE (Manutenção)
-- Executar periodicamente via cron, mas incluímos aqui para o ambiente atual.
ANALYZE public.profissionais;
ANALYZE public.piso_competencia_profissional;

-- 5. SEGURANÇA: GRANTS
GRANT SELECT ON public.mv_piso_resumo_competencia TO authenticated;
GRANT ALL ON public.mv_piso_resumo_competencia TO service_role;
