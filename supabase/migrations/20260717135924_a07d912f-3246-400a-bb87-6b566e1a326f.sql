-- 7A: Verificação e consumo de código de recuperação MFA
CREATE OR REPLACE FUNCTION public.verify_and_consume_backup_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  _codes jsonb;
  _new_codes jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Requer usuário autenticado' USING ERRCODE = '42501';
  END IF;
  IF _code IS NULL OR length(btrim(_code)) < 8 OR length(btrim(_code)) > 32 THEN
    RETURN false;
  END IF;

  _hash := encode(extensions.digest(upper(btrim(_code)), 'sha256'), 'hex');

  SELECT COALESCE(mfa_backup_codes, '[]'::jsonb) INTO _codes
    FROM public.usuarios
   WHERE id = _uid AND deleted_at IS NULL AND status = 'ativo';

  IF _codes IS NULL OR jsonb_typeof(_codes) <> 'array' THEN
    RETURN false;
  END IF;

  IF NOT (_codes ? _hash) THEN
    INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
    VALUES (_uid, 'custom'::public.operacao_auditoria, 'public.usuarios', _uid::text,
            jsonb_build_object('acao','auth.mfa_backup_falha','origem','server'));
    RETURN false;
  END IF;

  SELECT COALESCE(jsonb_agg(v), '[]'::jsonb) INTO _new_codes
    FROM jsonb_array_elements_text(_codes) v
   WHERE v <> _hash;

  UPDATE public.usuarios
     SET mfa_backup_codes = _new_codes
   WHERE id = _uid;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (_uid, 'custom'::public.operacao_auditoria, 'public.usuarios', _uid::text,
          jsonb_build_object(
            'acao','auth.mfa_backup_utilizado',
            'origem','server',
            'restantes', jsonb_array_length(_new_codes)
          ));

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_and_consume_backup_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_and_consume_backup_code(text) TO authenticated;

COMMENT ON FUNCTION public.verify_and_consume_backup_code(text) IS
'7A/5D.1: valida código de backup MFA (SHA-256, uppercase) do usuário autenticado e consome o hash correspondente. Retorna true/false. Registra em audit_log.';