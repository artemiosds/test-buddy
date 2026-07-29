CREATE OR REPLACE FUNCTION public.hsm_config_ler()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO public.hsm_config (id)
  VALUES (true)
  ON CONFLICT (id) DO NOTHING;

  RETURN (
    SELECT jsonb_build_object(
      'ativo', ativo,
      'somente_leitura', somente_leitura,
      'prompt_sistema', prompt_sistema,
      'modo_execucao', modo_execucao,
      'ferramentas_habilitadas', ferramentas_habilitadas,
      'agentes_habilitados', agentes_habilitados,
      'limites', limites,
      'cache_config', cache_config,
      'retencao_config', retencao_config,
      'observabilidade_config', observabilidade_config,
      'metadata', metadata,
      'updated_at', updated_at
    )
    FROM public.hsm_config
    WHERE id = true
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.hsm_config_salvar(
  _ativo boolean,
  _somente_leitura boolean,
  _prompt_sistema text,
  _modo_execucao text,
  _ferramentas_habilitadas jsonb,
  _agentes_habilitados jsonb,
  _limites jsonb,
  _cache_config jsonb,
  _retencao_config jsonb,
  _observabilidade_config jsonb,
  _metadata jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'sistema.configurar', NULL, NULL)
    OR public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _modo_execucao NOT IN ('assistido', 'somente_leitura', 'autonomo_controlado') THEN
    RAISE EXCEPTION 'Modo de execução inválido';
  END IF;

  IF jsonb_typeof(COALESCE(_ferramentas_habilitadas, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de ferramentas inválida';
  END IF;

  IF jsonb_typeof(COALESCE(_agentes_habilitados, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Lista de agentes inválida';
  END IF;

  INSERT INTO public.hsm_config (
    id,
    ativo,
    somente_leitura,
    prompt_sistema,
    modo_execucao,
    ferramentas_habilitadas,
    agentes_habilitados,
    limites,
    cache_config,
    retencao_config,
    observabilidade_config,
    metadata,
    updated_at
  )
  VALUES (
    true,
    COALESCE(_ativo, true),
    COALESCE(_somente_leitura, false),
    NULLIF(BTRIM(_prompt_sistema), ''),
    _modo_execucao,
    COALESCE(_ferramentas_habilitadas, '[]'::jsonb),
    COALESCE(_agentes_habilitados, '[]'::jsonb),
    COALESCE(_limites, '{}'::jsonb),
    COALESCE(_cache_config, '{}'::jsonb),
    COALESCE(_retencao_config, '{}'::jsonb),
    COALESCE(_observabilidade_config, '{}'::jsonb),
    COALESCE(_metadata, '{}'::jsonb),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    ativo = EXCLUDED.ativo,
    somente_leitura = EXCLUDED.somente_leitura,
    prompt_sistema = EXCLUDED.prompt_sistema,
    modo_execucao = EXCLUDED.modo_execucao,
    ferramentas_habilitadas = EXCLUDED.ferramentas_habilitadas,
    agentes_habilitados = EXCLUDED.agentes_habilitados,
    limites = EXCLUDED.limites,
    cache_config = EXCLUDED.cache_config,
    retencao_config = EXCLUDED.retencao_config,
    observabilidade_config = EXCLUDED.observabilidade_config,
    metadata = EXCLUDED.metadata,
    updated_at = now();

  RETURN public.hsm_config_ler();
END;
$$;

REVOKE ALL ON FUNCTION public.hsm_config_ler() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hsm_config_salvar(boolean, boolean, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hsm_config_salvar(boolean, boolean, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;