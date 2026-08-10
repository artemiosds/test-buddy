CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_competencia_id uuid, p_unidade_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    result json;
    v_status_breakdown json;
    v_top_unidades json;
    v_top_cargos json;
    v_vinculo_breakdown json;
    v_rh_kpis json;
BEGIN
    -- Breakdown por status (Normalizado para o UI com cast para text para permitir LIKE)
    SELECT json_build_object(
        'ativo', count(*) FILTER (WHERE (status::text) = 'ativo'),
        'afastado', count(*) FILTER (WHERE (status::text) IN ('afastado', 'afastamento_inss', 'cedido')),
        'ferias', count(*) FILTER (WHERE (status::text) = 'ferias'),
        'licenca', count(*) FILTER (WHERE (status::text) LIKE 'licenca_%'),
        'desligado', count(*) FILTER (WHERE (status::text) IN ('desligado', 'vacancia', 'falta_pad')),
        'inativo', count(*) FILTER (WHERE (status::text) = 'inativo')
    )
    INTO v_status_breakdown
    FROM public.profissionais
    WHERE deleted_at IS NULL
      AND (p_unidade_id IS NULL OR unidade_id = p_unidade_id);

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

    -- Breakdown por vínculo (Normalizado)
    SELECT json_build_object(
        'efetivos', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.vinculos v WHERE v.id = p.vinculo_id AND v.nome ILIKE '%efetivo%')),
        'temporarios', count(*) FILTER (WHERE EXISTS (SELECT 1 FROM public.vinculos v WHERE v.id = p.vinculo_id AND (v.nome ILIKE '%contratado%' OR v.nome ILIKE '%temporário%'))),
        'outros', count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v WHERE v.id = p.vinculo_id AND (v.nome ILIKE '%efetivo%' OR v.nome ILIKE '%contratado%' OR v.nome ILIKE '%temporário%')))
    )
    INTO v_vinculo_breakdown
    FROM public.profissionais p
    WHERE deleted_at IS NULL
      AND (p_unidade_id IS NULL OR unidade_id = p_unidade_id);

    -- KPIs de RH (Frequências e Horas)
    SELECT json_build_object(
        'enviadas', count(*) FILTER (WHERE f.status::text = 'enviada'),
        'pendentes', count(*) FILTER (WHERE f.status::text = 'rascunho' OR f.status::text = 'rejeitada'),
        'aprovadas', count(*) FILTER (WHERE f.status::text = 'aprovada'),
        'total_horas_extras', COALESCE(SUM(total_horas_extras), 0),
        'total_faltas', COALESCE(SUM(total_faltas), 0)
    )
    INTO v_rh_kpis
    FROM public.frequencias f
    JOIN public.competencia_unidades cu ON f.competencia_unidade_id = cu.id
    WHERE cu.competencia_id = p_competencia_id
      AND f.deleted_at IS NULL
      AND (p_unidade_id IS NULL OR cu.unidade_id = p_unidade_id);

    -- Resultado Final
    result := json_build_object(
        'status_breakdown', v_status_breakdown,
        'top_unidades', COALESCE(v_top_unidades, '[]'::json),
        'top_cargos', COALESCE(v_top_cargos, '[]'::json),
        'vinculo_breakdown', v_vinculo_breakdown,
        'rh_kpis', v_rh_kpis
    );

    RETURN result;
END;
$function$;