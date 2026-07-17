-- Sublote 6B: RPC segura para registrar ações do lado cliente em audit_log
-- Restringe operação a {login,logout,custom}, força usuario_id = auth.uid(),
-- limita tamanho de contexto para prevenir abuso.

CREATE OR REPLACE FUNCTION public.log_client_action(
  _operacao public.operacao_auditoria,
  _acao text,
  _contexto jsonb DEFAULT '{}'::jsonb,
  _user_agent text DEFAULT NULL,
  _registro_id text DEFAULT NULL,
  _tabela text DEFAULT '_client_action'
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid uuid := auth.uid();
  _new_id bigint;
  _ctx jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'log_client_action requer usuário autenticado' USING ERRCODE = '42501';
  END IF;

  IF _operacao NOT IN ('login','logout','custom') THEN
    RAISE EXCEPTION 'operacao % não permitida via log_client_action', _operacao
      USING ERRCODE = '22023';
  END IF;

  IF _acao IS NULL OR length(_acao) = 0 OR length(_acao) > 128 THEN
    RAISE EXCEPTION 'acao inválida (1..128 chars)' USING ERRCODE = '22023';
  END IF;

  -- Guard tamanho de contexto (~8KB)
  IF octet_length(coalesce(_contexto::text,'')) > 8192 THEN
    RAISE EXCEPTION 'contexto excede 8KB' USING ERRCODE = '22023';
  END IF;

  _ctx := coalesce(_contexto,'{}'::jsonb)
    || jsonb_build_object('acao', _acao, 'origem', 'client');

  INSERT INTO public.audit_log(
    usuario_id, operacao, tabela, registro_id,
    valor_anterior, valor_novo, user_agent, contexto
  )
  VALUES (
    _uid, _operacao, _tabela, _registro_id,
    NULL, NULL,
    NULLIF(left(coalesce(_user_agent,''), 512), ''),
    _ctx
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- Restringe execução: apenas authenticated (e service_role implícito)
REVOKE ALL ON FUNCTION public.log_client_action(public.operacao_auditoria, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_client_action(public.operacao_auditoria, text, jsonb, text, text, text) TO authenticated;