CREATE OR REPLACE FUNCTION public.get_cargos_funcoes_uso()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'cargos', (
            SELECT json_object_agg(id, count)
            FROM (
                SELECT cargo_id as id, COUNT(*)::INT as count
                FROM public.profissionais
                WHERE deleted_at IS NULL AND status = 'ativo'
                AND cargo_id IS NOT NULL
                GROUP BY cargo_id
            ) c
        ),
        'funcoes', (
            SELECT json_object_agg(id, count)
            FROM (
                SELECT funcao_id as id, COUNT(*)::INT as count
                FROM public.profissionais
                WHERE deleted_at IS NULL AND status = 'ativo'
                AND funcao_id IS NOT NULL
                GROUP BY funcao_id
            ) f
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cargos_funcoes_uso() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cargos_funcoes_uso() TO service_role;
