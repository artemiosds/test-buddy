CREATE OR REPLACE FUNCTION public.get_quadro_lotacao(p_unidade_id uuid DEFAULT NULL::uuid, p_setor_id uuid DEFAULT NULL::uuid, p_cargo_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(unidade_id uuid, unidade_nome text, unidade_sigla text, setor_id uuid, setor_nome text, cargo_id uuid, cargo_nome text, funcao_id uuid, funcao_nome text, total bigint, ativos bigint, afastados bigint, ferias bigint, licencas bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    p.unidade_id,
    COALESCE(u.nome, 'Sem Unidade')::text AS unidade_nome,
    u.sigla::text AS unidade_sigla,
    p.setor_id,
    COALESCE(s.nome, 'Sem Setor')::text AS setor_nome,
    p.cargo_id,
    COALESCE(c.nome, 'Sem Cargo')::text AS cargo_nome,
    p.funcao_id,
    COALESCE(f.nome, 'Sem Função')::text AS funcao_nome,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE p.status::text = 'ativo')::bigint AS ativos,
    COUNT(*) FILTER (WHERE p.status::text = 'afastado')::bigint AS afastados,
    COUNT(*) FILTER (WHERE p.status::text = 'ferias')::bigint AS ferias,
    COUNT(*) FILTER (WHERE (p.status::text LIKE 'licenca_%' OR p.status::text = 'afastamento_saude'))::bigint AS licencas
  FROM profissionais p
  LEFT JOIN unidades u ON p.unidade_id = u.id
  LEFT JOIN setores s ON p.setor_id = s.id
  LEFT JOIN cargos c ON p.cargo_id = c.id
  LEFT JOIN funcoes f ON p.funcao_id = f.id
  WHERE p.deleted_at IS NULL
    AND (p_unidade_id IS NULL OR p.unidade_id = p_unidade_id)
    AND (p_setor_id IS NULL OR p.setor_id = p_setor_id)
    AND (p_cargo_id IS NULL OR p.cargo_id = p_cargo_id)
  GROUP BY 
    p.unidade_id, u.nome, u.sigla, 
    p.setor_id, s.nome, 
    p.cargo_id, c.nome, 
    p.funcao_id, f.nome;
END;
$function$;