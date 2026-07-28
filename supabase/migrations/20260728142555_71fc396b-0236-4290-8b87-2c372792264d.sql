CREATE OR REPLACE FUNCTION public.piso_extracao_config_ler()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _r RECORD;
  _key text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_master(_caller)
          OR public.has_permission(_caller, 'piso.visualizar')
          OR public.has_permission(_caller, 'configuracao.editar')) THEN
    RAISE EXCEPTION 'Sem permissão para visualizar a configuração de extração' USING ERRCODE = '42501';
  END IF;

  SELECT motor, ia_fornecedor, ia_modelo, ia_habilitada, ocr_idioma, ia_api_key
    INTO _r
    FROM public.piso_extracao_config WHERE id = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('existe', false);
  END IF;

  _key := NULLIF(btrim(COALESCE(_r.ia_api_key, '')), '');

  RETURN jsonb_build_object(
    'existe', true,
    'motor', _r.motor,
    'ia_fornecedor', _r.ia_fornecedor,
    'ia_modelo', _r.ia_modelo,
    'ia_habilitada', _r.ia_habilitada,
    'ocr_idioma', _r.ocr_idioma,
    'tem_chave', _key IS NOT NULL,
    'chave_final4', CASE WHEN _key IS NULL THEN NULL ELSE right(_key, 4) END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.piso_extracao_config_salvar(
  _motor text,
  _ia_fornecedor text,
  _ia_modelo text,
  _ia_habilitada boolean,
  _ocr_idioma text,
  _ia_api_key text DEFAULT NULL,
  _atualizar_chave boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_master(_caller) OR public.has_permission(_caller, 'configuracao.editar')) THEN
    RAISE EXCEPTION 'Sem permissão para editar a configuração de extração' USING ERRCODE = '42501';
  END IF;

  IF _motor NOT IN ('automatico','texto','ocr_local','ia_visao') THEN
    RAISE EXCEPTION 'Motor inválido' USING ERRCODE = '22023';
  END IF;
  IF _ia_fornecedor NOT IN ('gemini','lovable') THEN
    RAISE EXCEPTION 'Fornecedor inválido' USING ERRCODE = '22023';
  END IF;
  IF _ia_modelo IS NULL OR length(btrim(_ia_modelo)) = 0 OR length(_ia_modelo) > 120 THEN
    RAISE EXCEPTION 'Modelo inválido' USING ERRCODE = '22023';
  END IF;
  IF _ia_api_key IS NOT NULL AND length(_ia_api_key) > 400 THEN
    RAISE EXCEPTION 'Chave inválida' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.piso_extracao_config AS c
    (id, motor, ia_fornecedor, ia_modelo, ia_habilitada, ocr_idioma, ia_api_key, updated_by)
  VALUES
    (true, _motor, _ia_fornecedor, btrim(_ia_modelo), COALESCE(_ia_habilitada,false),
     COALESCE(NULLIF(btrim(COALESCE(_ocr_idioma,'')),''),'por'),
     CASE WHEN _atualizar_chave THEN NULLIF(btrim(COALESCE(_ia_api_key,'')),'') ELSE NULL END,
     _caller)
  ON CONFLICT (id) DO UPDATE SET
    motor = EXCLUDED.motor,
    ia_fornecedor = EXCLUDED.ia_fornecedor,
    ia_modelo = EXCLUDED.ia_modelo,
    ia_habilitada = EXCLUDED.ia_habilitada,
    ocr_idioma = EXCLUDED.ocr_idioma,
    ia_api_key = CASE WHEN _atualizar_chave THEN EXCLUDED.ia_api_key ELSE c.ia_api_key END,
    updated_by = _caller;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (_caller, 'custom'::public.operacao_auditoria, 'public.piso_extracao_config', 'true',
          jsonb_build_object('acao','piso.extracao.config.salvar','origem','client',
                             'motor',_motor,'fornecedor',_ia_fornecedor,
                             'chave_alterada', _atualizar_chave));

  RETURN public.piso_extracao_config_ler();
END;
$$;

CREATE OR REPLACE FUNCTION public.piso_extracao_ia_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _caller uuid := auth.uid();
  _key text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;
  IF NOT (public.is_master(_caller)
          OR public.has_permission(_caller, 'piso.importar')
          OR public.has_permission(_caller, 'configuracao.editar')) THEN
    RAISE EXCEPTION 'Sem permissão para utilizar a IA de Visão' USING ERRCODE = '42501';
  END IF;

  SELECT NULLIF(btrim(COALESCE(ia_api_key,'')),'') INTO _key
    FROM public.piso_extracao_config WHERE id = true;
  RETURN _key;
END;
$$;

REVOKE ALL ON FUNCTION public.piso_extracao_config_ler() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.piso_extracao_config_salvar(text,text,text,boolean,text,text,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.piso_extracao_ia_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.piso_extracao_config_ler() TO authenticated;
GRANT EXECUTE ON FUNCTION public.piso_extracao_config_salvar(text,text,text,boolean,text,text,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.piso_extracao_ia_key() TO authenticated;