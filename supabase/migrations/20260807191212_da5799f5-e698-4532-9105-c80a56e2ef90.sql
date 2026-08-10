
CREATE OR REPLACE FUNCTION public.get_cargos_funcoes_uso()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'cargos', (
            SELECT json_object_agg(cargo_id, count)
            FROM (
                SELECT cargo_id, count(*) as count
                FROM public.profissionais
                WHERE deleted_at IS NULL AND cargo_id IS NOT NULL
                GROUP BY cargo_id
            ) c
        ),
        'funcoes', (
            SELECT json_object_agg(funcao_id, count)
            FROM (
                SELECT funcao_id, count(*) as count
                FROM public.profissionais
                WHERE deleted_at IS NULL AND funcao_id IS NOT NULL
                GROUP BY funcao_id
            ) f
        )
    ) INTO result;
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cargos_funcoes_uso() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cargos_funcoes_uso() TO service_role;
