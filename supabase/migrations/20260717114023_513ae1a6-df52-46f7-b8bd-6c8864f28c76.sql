
-- =====================================================================
-- Sublote 5A.1 — Endurecimento de 6 funções SECURITY DEFINER
-- Migração atômica (transacional). Ordem: base primeiro, dependentes depois.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) is_master — inline o self-check para evitar recursão do guard.
--    Convertida para plpgsql (era SQL) para permitir RAISE.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _caller_master boolean;
BEGIN
  -- Guard: se o caller for authenticated e estiver consultando dado de outro
  -- usuário, exige que ele próprio seja Master. Inline (não chama is_master
  -- recursivamente) para clareza e para não depender da própria função.
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller THEN
    SELECT COALESCE((acesso_todas_unidades AND acesso_todas_secretarias), false)
      INTO _caller_master
      FROM public.usuarios
     WHERE id = _caller AND deleted_at IS NULL AND status = 'ativo';
    IF NOT COALESCE(_caller_master, false) THEN
      RAISE EXCEPTION 'Não autorizado a consultar dados de outro usuário'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN COALESCE((
    SELECT (acesso_todas_unidades AND acesso_todas_secretarias)
    FROM public.usuarios
    WHERE id = _user_id AND deleted_at IS NULL AND status = 'ativo'
  ), false);
END;
$function$;

-- ---------------------------------------------------------------------
-- 2) has_permission — guard no topo, corpo original preservado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id uuid,
  _codigo text,
  _unidade_id uuid DEFAULT NULL,
  _secretaria_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _concedida_perfil BOOLEAN;
  _usuario_ativo BOOLEAN;
BEGIN
  -- Guard: authenticated só consulta permissão de si próprio, exceto Master.
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar permissões de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL OR _codigo IS NULL THEN
    RETURN false;
  END IF;

  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF public.is_master(_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'revogada' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;
  IF _revogada THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'concedida' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;
  IF _concedida_individual THEN RETURN true; END IF;

  IF _perfil_id IS NOT NULL THEN
    SELECT COALESCE(concedida, false) INTO _concedida_perfil
    FROM public.perfil_permissoes
    WHERE perfil_id = _perfil_id AND permissao_id = _perm_id;
    RETURN COALESCE(_concedida_perfil, false);
  END IF;

  RETURN false;
END;
$function$;

-- ---------------------------------------------------------------------
-- 3) user_has_unit — guard + corpo original.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_unit(_user_id uuid, _unidade_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar vínculos de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN
    public.is_master(_user_id)
    OR COALESCE((SELECT acesso_todas_unidades FROM public.usuarios
                 WHERE id = _user_id AND deleted_at IS NULL), false)
    OR EXISTS (
      SELECT 1 FROM public.usuario_unidades
      WHERE usuario_id = _user_id AND unidade_id = _unidade_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
END;
$function$;

-- ---------------------------------------------------------------------
-- 4) user_has_secretaria — guard + corpo original.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_secretaria(_user_id uuid, _secretaria_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller
     AND NOT public.is_master(_caller) THEN
    RAISE EXCEPTION 'Não autorizado a consultar vínculos de outro usuário'
      USING ERRCODE = '42501';
  END IF;

  RETURN
    public.is_master(_user_id)
    OR COALESCE((SELECT acesso_todas_secretarias FROM public.usuarios
                 WHERE id = _user_id AND deleted_at IS NULL), false)
    OR EXISTS (
      SELECT 1 FROM public.usuarios
      WHERE id = _user_id AND secretaria_id = _secretaria_id AND deleted_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.usuario_secretarias
      WHERE usuario_id = _user_id AND secretaria_id = _secretaria_id
        AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    );
END;
$function$;

-- ---------------------------------------------------------------------
-- 5) proximo_numero_pendencia — guard exigindo pendencia.criar no escopo.
--    Chamador único (pendencias.functions.ts:170) já valida antes.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.proximo_numero_pendencia(_secretaria_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _ano INT := EXTRACT(YEAR FROM now())::int;
  _sigla TEXT;
  _n INT;
  _caller uuid := auth.uid();
BEGIN
  -- Guard: authenticated precisa ter pendencia.criar na secretaria.
  -- Preserva execução por service_role/jobs internos (auth.uid() IS NULL).
  IF _caller IS NOT NULL
     AND NOT public.is_master(_caller)
     AND NOT public.has_permission(_caller, 'pendencia.criar', NULL, _secretaria_id) THEN
    RAISE EXCEPTION 'Sem permissão para gerar número de pendência nesta secretaria'
      USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(NULLIF(sigla,''),'SMS') INTO _sigla
    FROM public.secretarias WHERE id = _secretaria_id;
  IF _sigla IS NULL THEN _sigla := 'SMS'; END IF;

  INSERT INTO public.pendencia_numeros(secretaria_id, ano, ultimo)
    VALUES (_secretaria_id, _ano, 1)
  ON CONFLICT (secretaria_id, ano) DO UPDATE
    SET ultimo = public.pendencia_numeros.ultimo + 1
  RETURNING ultimo INTO _n;

  RETURN _sigla || '-' || _ano || '-' || LPAD(_n::text, 5, '0');
END;
$function$;

-- ---------------------------------------------------------------------
-- 6) emit_evento — Opção A: guard por agregado.
--    Chamadas legítimas (26 call sites em server functions) já têm a
--    permissão do agregado validada antes; este guard é defesa em
--    profundidade contra chamadas RPC diretas de authenticated.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.emit_evento(
  _tipo text,
  _agregado text,
  _agregado_id text,
  _dados jsonb DEFAULT '{}'::jsonb,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _correlation_id uuid DEFAULT NULL,
  _causation_id uuid DEFAULT NULL,
  _idempotency_key text DEFAULT NULL,
  _versao integer DEFAULT 1
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $function$
DECLARE
  _new_id UUID := gen_random_uuid();
  _corr   UUID := COALESCE(_correlation_id, _new_id);
  _existing UUID;
  _caller uuid := auth.uid();
  _codigo_req text;
BEGIN
  IF _tipo IS NULL OR _agregado IS NULL THEN
    RAISE EXCEPTION 'emit_evento: tipo e agregado são obrigatórios';
  END IF;

  -- Guard Opção A: se authenticated, exige permissão coerente com o agregado.
  -- service_role/jobs internos (auth.uid() IS NULL) e Master passam direto.
  IF _caller IS NOT NULL AND NOT public.is_master(_caller) THEN
    _codigo_req := CASE _agregado
      WHEN 'competencia'             THEN 'competencia.criar'
      WHEN 'frequencia'              THEN 'frequencia.criar'
      WHEN 'frequencia_profissional' THEN 'frequencia.editar'
      WHEN 'pendencia'               THEN 'pendencia.criar'
      WHEN 'usuario'                 THEN 'usuario.editar'
      WHEN 'permissao'               THEN 'usuario.permissoes'
      -- documento, assinatura, sistema: abertos (uso amplo, sem código único).
      ELSE NULL
    END;
    IF _codigo_req IS NOT NULL
       AND NOT public.has_permission(_caller, _codigo_req) THEN
      RAISE EXCEPTION 'Sem permissão para emitir evento do agregado %', _agregado
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF _idempotency_key IS NOT NULL THEN
    SELECT id INTO _existing FROM public.eventos_dominio
      WHERE idempotency_key = _idempotency_key LIMIT 1;
    IF _existing IS NOT NULL THEN
      RETURN _existing;
    END IF;
  END IF;

  INSERT INTO public.eventos_dominio(
    id, tipo, agregado, agregado_id, dados, metadata,
    correlation_id, causation_id, idempotency_key,
    versao_evento, status, emitido_por
  ) VALUES (
    _new_id, _tipo, _agregado, _agregado_id,
    COALESCE(_dados,'{}'::jsonb), COALESCE(_metadata,'{}'::jsonb),
    _corr, _causation_id, _idempotency_key,
    COALESCE(_versao,1), 'pendente', auth.uid()
  );
  RETURN _new_id;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO _existing FROM public.eventos_dominio
    WHERE idempotency_key = _idempotency_key LIMIT 1;
  RETURN _existing;
END;
$function$;
