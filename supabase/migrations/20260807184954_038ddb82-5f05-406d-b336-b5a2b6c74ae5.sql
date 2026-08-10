CREATE OR REPLACE FUNCTION public.get_setores_uso(p_unidade_id uuid)
RETURNS TABLE (setor_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id as setor_id,
    COUNT(p.id) as total
  FROM public.setores s
  LEFT JOIN public.profissionais p ON p.setor_id = s.id AND p.deleted_at IS NULL
  WHERE s.unidade_id = p_unidade_id
    AND s.deleted_at IS NULL
  GROUP BY s.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_setores_uso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_setores_uso(uuid) TO service_role;
