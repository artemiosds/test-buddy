CREATE OR REPLACE FUNCTION public.get_dashboard_summary(p_competencia_id uuid, p_unidade_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE    
    v_result JSONB;
BEGIN    
    WITH filtered_freq AS (        
        SELECT             
            f.id,            
            CASE 
                WHEN LOWER(TRIM(f.status::text)) IN ('aprovada', 'aprovado', 'aprovadas') THEN 'aprovadas'
                WHEN LOWER(TRIM(f.status::text)) IN ('em_analise', 'em analise', 'em análise', 'enviada', 'enviadas') THEN 'em_analise'
                WHEN LOWER(TRIM(f.status::text)) IN ('rascunho', 'rascunhos', 'pendente', 'pendentes') THEN 'rascunho'
                WHEN LOWER(TRIM(f.status::text)) IN ('rejeitada', 'rejeitado', 'rejeitadas') THEN 'rejeitadas'
                ELSE LOWER(TRIM(f.status::text))
            END AS normalized_status,            
            COALESCE(f.total_profissionais, 0) AS total_profissionais,            
            COALESCE(f.total_faltas, 0) AS total_faltas,            
            COALESCE(f.total_horas_extras, 0) AS total_horas_extras,            
            cu.unidade_id,            
            f.vinculo_id        
        FROM frequencias f        
        JOIN competencia_unidades cu ON f.competencia_unidade_id = cu.id        
        WHERE cu.competencia_id = p_competencia_id        
          AND (p_unidade_id IS NULL OR cu.unidade_id = p_unidade_id)        
          AND f.deleted_at IS NULL    
    ),    
    status_counts AS (        
        SELECT normalized_status, count(*) AS total        
        FROM filtered_freq        
        GROUP BY normalized_status    
    ),    
    kpis AS (        
        SELECT             
            COALESCE(sum(CASE WHEN normalized_status = 'aprovadas' THEN 1 ELSE 0 END), 0) AS aprovadas,            
            COALESCE(sum(CASE WHEN normalized_status = 'em_analise' THEN 1 ELSE 0 END), 0) AS enviadas,            
            COALESCE(sum(CASE WHEN normalized_status = 'rascunho' THEN 1 ELSE 0 END), 0) AS pendentes,            
            COALESCE(sum(total_horas_extras), 0) AS total_he,            
            COALESCE(sum(total_faltas), 0) AS total_faltas        
        FROM filtered_freq    
    ),    
    vinculos AS (        
        SELECT COALESCE(v.nome, 'Sem Vínculo') as nome, count(p.id) AS total        
        FROM profissionais p        
        LEFT JOIN vinculos v ON p.vinculo_id = v.id        
        WHERE (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id)        
          AND p.deleted_at IS NULL        
        GROUP BY v.nome    
    ),    
    top_units AS (        
        SELECT u.id, u.nome, u.sigla, count(p.id) AS total        
        FROM unidades u        
        LEFT JOIN profissionais p ON p.unidade_id = u.id AND p.deleted_at IS NULL        
        WHERE u.status = 'ativa' AND u.deleted_at IS NULL        
        GROUP BY u.id, u.nome, u.sigla        
        ORDER BY total DESC        
        LIMIT 5    
    ),
    status_prof AS (
        SELECT 
            CASE 
                WHEN situacao_funcional IS NULL THEN 'ativo'
                ELSE LOWER(TRIM(situacao_funcional::text))
            END as status_norm,
            count(*) as total
        FROM profissionais
        WHERE (p_unidade_id IS NULL OR unidade_id = p_unidade_id)
          AND deleted_at IS NULL
        GROUP BY 1
    )
    SELECT jsonb_build_object(        
        'status_breakdown', COALESCE((SELECT jsonb_object_agg(status_norm, total) FROM status_prof), '{}'::jsonb),        
        'vinculo_breakdown', COALESCE((SELECT jsonb_object_agg(nome, total) FROM vinculos), '{}'::jsonb),        
        'rh_kpis', (
            SELECT jsonb_build_object(            
                'aprovadas', aprovadas,            
                'enviadas', enviadas,            
                'pendentes', pendentes,            
                'total_horas_extras', total_he,            
                'total_faltas', total_faltas        
            ) FROM kpis
        ),        
        'top_unidades', COALESCE((SELECT jsonb_agg(u) FROM (SELECT * FROM top_units) u), '[]'::jsonb)    
    ) INTO v_result;    

    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_summary(uuid, uuid) TO service_role;