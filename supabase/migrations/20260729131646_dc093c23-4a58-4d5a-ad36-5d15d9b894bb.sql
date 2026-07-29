CREATE OR REPLACE FUNCTION public.hsm_config_ler()
RETURNS jsonb
LANGUAGE plpgsql
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

REVOKE ALL ON FUNCTION public.hsm_config_ler() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO authenticated;