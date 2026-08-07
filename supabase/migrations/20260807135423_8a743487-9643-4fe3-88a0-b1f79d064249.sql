
-- View de Integridade (Migração SQL)
CREATE OR REPLACE VIEW public.v_integridade_profissionais AS
SELECT
    unidade_id,
    SUM(CASE WHEN email IS NULL OR email = '' THEN 1 ELSE 0 END)::int AS sem_email,
    SUM(CASE WHEN telefone IS NULL OR telefone = '' THEN 1 ELSE 0 END)::int AS sem_telefone,
    SUM(CASE WHEN banco IS NULL OR banco = '' OR conta_corrente IS NULL OR conta_corrente = '' THEN 1 ELSE 0 END)::int AS sem_dados_bancarios,
    SUM(CASE WHEN matricula IS NULL OR matricula = '' THEN 1 ELSE 0 END)::int AS sem_matricula,
    SUM(CASE WHEN setor_id IS NULL THEN 1 ELSE 0 END)::int AS sem_setor,
    SUM(CASE WHEN funcao_id IS NULL THEN 1 ELSE 0 END)::int AS sem_funcao,
    SUM(CASE WHEN cargo_id IS NULL THEN 1 ELSE 0 END)::int AS sem_cargo,
    COUNT(*)::int AS total_profissionais,
    SUM(CASE 
        WHEN email IS NULL OR email = '' 
        OR telefone IS NULL OR telefone = ''
        OR banco IS NULL OR banco = '' OR conta_corrente IS NULL OR conta_corrente = ''
        OR matricula IS NULL OR matricula = ''
        OR setor_id IS NULL
        OR funcao_id IS NULL
        OR cargo_id IS NULL
        THEN 1 ELSE 0 END)::int AS cadastros_incompletos
FROM public.profissionais
WHERE deleted_at IS NULL
GROUP BY unidade_id;

GRANT SELECT ON public.v_integridade_profissionais TO authenticated;
GRANT SELECT ON public.v_integridade_profissionais TO service_role;

-- RPC de Agregação (Migração SQL)
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_competencia_id UUID,
    p_unidade_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSON;
    v_status_breakdown JSON;
    v_top_unidades JSON;
    v_top_cargos JSON;
    v_vinculo_breakdown JSON;
BEGIN
    -- Breakdown por Status (Situacao Funcional)
    SELECT json_object_agg(COALESCE(status_label, '—'), count)
    INTO v_status_breakdown
    FROM (
        SELECT COALESCE(situacao_funcional, status) as status_label, COUNT(*) as count
        FROM profissionais
        WHERE deleted_at IS NULL
        AND (p_unidade_id IS NULL OR unidade_id = p_unidade_id)
        GROUP BY 1
    ) s;

    -- Top 10 por Unidade
    SELECT json_agg(t)
    INTO v_top_unidades
    FROM (
        SELECT 
            p.unidade_id as id,
            u.nome,
            u.sigla,
            COUNT(*) as total
        FROM profissionais p
        LEFT JOIN unidades u ON p.unidade_id = u.id
        WHERE p.deleted_at IS NULL
        AND p.unidade_id IS NOT NULL
        GROUP BY p.unidade_id, u.nome, u.sigla
        ORDER BY total DESC
        LIMIT 10
    ) t;

    -- Top 10 por Cargo
    SELECT json_agg(t)
    INTO v_top_cargos
    FROM (
        SELECT 
            p.cargo_id as id,
            c.nome,
            COUNT(*) as total
        FROM profissionais p
        LEFT JOIN cargos c ON p.cargo_id = c.id
        WHERE p.deleted_at IS NULL
        AND p.cargo_id IS NOT NULL
        AND (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id)
        GROUP BY p.cargo_id, c.nome
        ORDER BY total DESC
        LIMIT 10
    ) t;

    -- Breakdown por Vínculo
    SELECT json_build_object(
        'efetivos', COUNT(*) FILTER (WHERE v.natureza = 'efetivo'),
        'temporarios', COUNT(*) FILTER (WHERE v.natureza = 'temporario'),
        'outros', COUNT(*) FILTER (WHERE v.natureza NOT IN ('efetivo', 'temporario') OR v.natureza IS NULL)
    )
    INTO v_vinculo_breakdown
    FROM profissionais p
    LEFT JOIN vinculos v ON p.vinculo_id = v.id
    WHERE p.deleted_at IS NULL
    AND (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id);

    -- Consolidação
    v_result := json_build_object(
        'status_breakdown', COALESCE(v_status_breakdown, '{}'::json),
        'top_unidades', COALESCE(v_top_unidades, '[]'::json),
        'top_cargos', COALESCE(v_top_cargos, '[]'::json),
        'vinculo_breakdown', COALESCE(v_vinculo_breakdown, '{"efetivos": 0, "temporarios": 0, "outros": 0}'::json)
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary TO service_role;
