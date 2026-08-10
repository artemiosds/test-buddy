-- Função para sumarizar status de profissionais por unidade
CREATE OR REPLACE FUNCTION public.get_unidade_dashboard_summary(p_unidade_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'total_profissionais', COUNT(*),
        'ativos', COUNT(*) FILTER (WHERE status = 'ativo'),
        'afastados', COUNT(*) FILTER (WHERE CAST(status AS text) LIKE 'afastado%'),
        'ferias', COUNT(*) FILTER (WHERE status = 'ferias'),
        'licencas', COUNT(*) FILTER (WHERE CAST(status AS text) LIKE 'licenca%'),
        'cargos', COUNT(DISTINCT cargo_id),
        'funcoes', COUNT(DISTINCT funcao_id)
    ) INTO result
    FROM profissionais
    WHERE unidade_id = p_unidade_id
      AND deleted_at IS NULL;

    RETURN COALESCE(result, json_build_object(
        'total_profissionais', 0,
        'ativos', 0,
        'afastados', 0,
        'ferias', 0,
        'licencas', 0,
        'cargos', 0,
        'funcoes', 0
    ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unidade_dashboard_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unidade_dashboard_summary(uuid) TO service_role;
