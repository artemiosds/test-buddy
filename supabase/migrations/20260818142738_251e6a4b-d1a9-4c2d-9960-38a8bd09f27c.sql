CREATE OR REPLACE FUNCTION public.get_dashboard_monthly_evolution(p_ano int, p_unidade_id uuid DEFAULT NULL)
RETURNS jsonb 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER 
SET search_path TO 'public'
AS $function$
DECLARE    
    v_result JSONB;
BEGIN    
    WITH meses AS (
        SELECT 
            m,
            TO_CHAR(TO_DATE(m::text, 'MM'), 'TMMon') AS mes_nome,
            LPAD(m::text, 2, '0') || '/' || p_ano::text AS competencia_str
        FROM generate_series(1, 12) m
    ),
    dados_mes AS (
        SELECT 
            m.m AS mes_num,
            m.mes_nome AS mes,
            COALESCE(COUNT(f.id) FILTER (WHERE LOWER(TRIM(f.status::text)) IN ('aprovada', 'aprovado', 'aprovadas')), 0) AS aprovadas,
            COALESCE(COUNT(f.id) FILTER (WHERE LOWER(TRIM(f.status::text)) IN ('em_analise', 'em analise', 'em análise', 'enviada', 'enviadas')), 0) AS em_analise,
            COALESCE(COUNT(f.id) FILTER (WHERE LOWER(TRIM(f.status::text)) IN ('rascunho', 'rascunhos', 'pendente', 'pendentes')), 0) AS rascunho,
            COUNT(f.id) AS total
        FROM meses m
        LEFT JOIN competencias c ON c.ano = p_ano AND c.mes = m.m AND c.deleted_at IS NULL
        LEFT JOIN competencia_unidades cu ON cu.competencia_id = c.id AND (p_unidade_id IS NULL OR cu.unidade_id = p_unidade_id)
        LEFT JOIN frequencias f ON f.competencia_unidade_id = cu.id AND f.deleted_at IS NULL
        GROUP BY m.m, m.mes_nome
        ORDER BY m.m
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'mes', mes,
            'aprovadas', aprovadas,
            'em_analise', em_analise,
            'rascunho', rascunho,
            'total', total,
            'taxa_aprovacao', CASE WHEN total > 0 THEN ROUND((aprovadas::numeric / total::numeric) * 100, 1) ELSE 0 END
        )
    ) INTO v_result
    FROM dados_mes;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_evolution(int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_monthly_evolution(int, uuid) TO service_role;