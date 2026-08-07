-- 1. Atualizar get_dashboard_summary para incluir KPIs de RH
CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
    p_competencia_id uuid,
    p_unidade_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    v_status_breakdown json;
    v_top_unidades json;
    v_top_cargos json;
    v_vinculo_breakdown json;
    v_rh_kpis json;
BEGIN
    -- Breakdown por status
    SELECT json_object_agg(status, count)
    INTO v_status_breakdown
    FROM (
        SELECT status, count(*) as count
        FROM public.profissionais
        WHERE deleted_at IS NULL
          AND (p_unidade_id IS NULL OR unidade_id = p_unidade_id)
        GROUP BY status
    ) s;

    -- Top unidades (distribuição de profissionais)
    SELECT json_agg(t)
    INTO v_top_unidades
    FROM (
        SELECT u.id, u.nome, u.sigla, count(p.id) as total
        FROM public.unidades u
        JOIN public.profissionais p ON p.unidade_id = u.id
        WHERE u.deleted_at IS NULL AND p.deleted_at IS NULL
          AND (p_unidade_id IS NULL OR u.id = p_unidade_id)
        GROUP BY u.id, u.nome, u.sigla
        ORDER BY total DESC
        LIMIT 5
    ) t;

    -- Top cargos
    SELECT json_agg(t)
    INTO v_top_cargos
    FROM (
        SELECT c.id, c.nome, count(p.id) as total
        FROM public.cargos c
        JOIN public.profissionais p ON p.cargo_id = c.id
        WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL
          AND (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id)
        GROUP BY c.id, c.nome
        ORDER BY total DESC
        LIMIT 5
    ) t;

    -- Vinculo breakdown
    SELECT json_build_object(
        'efetivos', count(*) FILTER (WHERE v.nome ILIKE '%efetivo%'),
        'temporarios', count(*) FILTER (WHERE v.nome ILIKE '%temporario%' OR v.nome ILIKE '%contratado%'),
        'outros', count(*) FILTER (WHERE v.nome NOT ILIKE '%efetivo%' AND v.nome NOT ILIKE '%temporario%' AND v.nome NOT ILIKE '%contratado%')
    )
    INTO v_vinculo_breakdown
    FROM public.profissionais p
    JOIN public.vinculos v ON v.id = p.vinculo_id
    WHERE p.deleted_at IS NULL
      AND (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id);

    -- RH KPIs (Frequências, HE, Faltas)
    SELECT json_build_object(
        'enviadas', count(*) FILTER (WHERE f.status IN ('enviada', 'em_analise', 'com_pendencias')),
        'pendentes', count(*) FILTER (WHERE f.status = 'rascunho'),
        'aprovadas', count(*) FILTER (WHERE f.status = 'aprovada'),
        'total_horas_extras', coalesce(sum(f.total_horas_extras), 0),
        'total_faltas', coalesce(sum(f.total_faltas), 0)
    )
    INTO v_rh_kpis
    FROM public.frequencias f
    JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
    WHERE f.deleted_at IS NULL
      AND cu.competencia_id = p_competencia_id
      AND (p_unidade_id IS NULL OR cu.unidade_id = p_unidade_id);

    result := json_build_object(
        'status_breakdown', coalesce(v_status_breakdown, '{}'::json),
        'top_unidades', coalesce(v_top_unidades, '[]'::json),
        'top_cargos', coalesce(v_top_cargos, '[]'::json),
        'vinculo_breakdown', coalesce(v_vinculo_breakdown, '{"efetivos":0,"temporarios":0,"outros":0}'::json),
        'rh_kpis', v_rh_kpis
    );

    RETURN result;
END;
$$ ;

-- 2. Criar RPC get_ranking_rh
CREATE OR REPLACE FUNCTION public.get_ranking_rh(
    p_competencia_id uuid
)
RETURNS TABLE (
    unidade_id uuid,
    unidade_nome text,
    unidade_sigla text,
    total_profissionais bigint,
    total_faltas numeric,
    total_horas_extras numeric,
    aprovadas bigint,
    total_folhas bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        u.id as unidade_id,
        u.nome as unidade_nome,
        u.sigla as unidade_sigla,
        sum(coalesce(f.total_profissionais, 0))::bigint as total_profissionais,
        sum(coalesce(f.total_faltas, 0))::numeric as total_faltas,
        sum(coalesce(f.total_horas_extras, 0))::numeric as total_horas_extras,
        count(*) FILTER (WHERE f.status = 'aprovada')::bigint as aprovadas,
        count(*)::bigint as total_folhas
    FROM public.frequencias f
    JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
    JOIN public.unidades u ON u.id = cu.unidade_id
    WHERE f.deleted_at IS NULL
      AND cu.competencia_id = p_competencia_id
    GROUP BY u.id, u.nome, u.sigla
    ORDER BY total_horas_extras DESC;
$$ ;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ranking_rh(uuid) TO authenticated;
