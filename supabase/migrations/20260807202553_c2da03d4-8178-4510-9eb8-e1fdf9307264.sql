
CREATE OR REPLACE FUNCTION public.get_quadro_lotacao(
    p_unidade_id uuid DEFAULT NULL, 
    p_setor_id uuid DEFAULT NULL, 
    p_cargo_id uuid DEFAULT NULL
)
RETURNS TABLE(
    unidade_id uuid, 
    unidade_nome text, 
    unidade_sigla text, 
    setor_id uuid, 
    setor_nome text, 
    cargo_id uuid, 
    cargo_nome text, 
    funcao_id uuid, 
    funcao_nome text, 
    total bigint, 
    ativos bigint, 
    afastados bigint, 
    ferias bigint, 
    licencas bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.unidade_id,
    COALESCE(u.nome, 'Sem Unidade') AS unidade_nome,
    u.sigla AS unidade_sigla,
    p.setor_id,
    COALESCE(s.nome, 'Sem Setor') AS setor_nome,
    p.cargo_id,
    COALESCE(c.nome, 'Sem Cargo') AS cargo_nome,
    p.funcao_id,
    COALESCE(f.nome, 'Sem Função') AS funcao_nome,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE p.status::text = 'ativo') AS ativos,
    COUNT(*) FILTER (WHERE p.status::text = 'afastado') AS afastados,
    COUNT(*) FILTER (WHERE p.status::text = 'ferias') AS ferias,
    COUNT(*) FILTER (WHERE (p.status::text LIKE 'licenca_%' OR p.status::text = 'afastamento_saude')) AS licencas
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
$$;
