-- 1) Helper: IP de origem a partir dos headers da requisição (PostgREST)
CREATE OR REPLACE FUNCTION public.audit_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  h jsonb;
  v text;
BEGIN
  BEGIN
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN RETURN NULL; END IF;
  v := coalesce(
    h->>'cf-connecting-ip',
    h->>'x-real-ip',
    split_part(coalesce(h->>'x-forwarded-for',''), ',', 1)
  );
  v := nullif(btrim(coalesce(v,'')), '');
  RETURN left(v, 64);
END;
$$;

-- 2) Helper: e-mail do usuário autenticado (JWT ou tabela usuarios)
CREATE OR REPLACE FUNCTION public.audit_actor_email(_uid uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  em text;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;
  BEGIN
    em := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email';
  EXCEPTION WHEN others THEN
    em := NULL;
  END;
  IF em IS NULL OR em = '' THEN
    SELECT u.email INTO em FROM public.usuarios u WHERE u.id = _uid LIMIT 1;
  END IF;
  RETURN nullif(em, '');
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_request_ip() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.audit_actor_email(uuid) TO authenticated, service_role;

-- 3) Trigger de auditoria: passa a gravar autor real, IP e tabela padronizada
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _op public.operacao_auditoria;
  _old JSONB; _new JSONB; _rid TEXT; _src JSONB;
  _uid uuid := auth.uid();
BEGIN
  IF TG_OP='INSERT' THEN
    _op:='insert'; _old:=NULL; _new:=to_jsonb(NEW); _src:=_new;
  ELSIF TG_OP='UPDATE' THEN
    _op:='update'; _old:=to_jsonb(OLD); _new:=to_jsonb(NEW); _src:=_new;
  ELSE
    _op:='delete'; _old:=to_jsonb(OLD); _new:=NULL; _src:=_old;
  END IF;

  _rid := _src->>'id';
  IF _rid IS NULL AND (_src ? 'usuario_id') AND (_src ? 'unidade_id') THEN
    _rid := (_src->>'usuario_id') || ':' || (_src->>'unidade_id');
  END IF;
  IF _rid IS NULL AND (_src ? 'usuario_id') AND (_src ? 'secretaria_id') THEN
    _rid := (_src->>'usuario_id') || ':' || (_src->>'secretaria_id');
  END IF;
  IF _rid IS NULL AND (_src ? 'usuario_id') AND (_src ? 'permissao_id') THEN
    _rid := (_src->>'usuario_id') || ':' || (_src->>'permissao_id');
  END IF;
  IF _rid IS NULL AND (_src ? 'perfil_id') AND (_src ? 'permissao_id') THEN
    _rid := (_src->>'perfil_id') || ':' || (_src->>'permissao_id');
  END IF;

  INSERT INTO public.audit_log(
    usuario_id, usuario_email, operacao, tabela, registro_id,
    valor_anterior, valor_novo, ip, user_agent
  )
  VALUES (
    _uid,
    public.audit_actor_email(_uid),
    _op,
    TG_TABLE_NAME,
    _rid,
    _old,
    _new,
    public.audit_request_ip(),
    left(coalesce(nullif(current_setting('request.headers', true), '')::jsonb->>'user-agent',''), 512)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) RPC do cliente: grava e-mail e IP reais
CREATE OR REPLACE FUNCTION public.log_client_action(
  _operacao operacao_auditoria,
  _acao text,
  _contexto jsonb DEFAULT '{}'::jsonb,
  _user_agent text DEFAULT NULL::text,
  _registro_id text DEFAULT NULL::text,
  _tabela text DEFAULT '_client_action'::text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  IF octet_length(coalesce(_contexto::text,'')) > 8192 THEN
    RAISE EXCEPTION 'contexto excede 8KB' USING ERRCODE = '22023';
  END IF;

  _ctx := coalesce(_contexto,'{}'::jsonb)
    || jsonb_build_object('acao', _acao, 'origem', 'client');

  INSERT INTO public.audit_log(
    usuario_id, usuario_email, operacao, tabela, registro_id,
    valor_anterior, valor_novo, ip, user_agent, contexto
  )
  VALUES (
    _uid, public.audit_actor_email(_uid), _operacao,
    regexp_replace(_tabela, '^public\.', ''),
    _registro_id,
    NULL, NULL,
    public.audit_request_ip(),
    NULLIF(left(coalesce(_user_agent,''), 512), ''),
    _ctx
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

-- 5) Backfill do autor nos registros existentes
UPDATE public.audit_log a
SET usuario_email = u.email
FROM public.usuarios u
WHERE a.usuario_email IS NULL
  AND a.usuario_id IS NOT NULL
  AND u.id = a.usuario_id;

-- 6) Padroniza nomes de tabela já gravados
UPDATE public.audit_log
SET tabela = regexp_replace(tabela, '^public\.', '')
WHERE tabela LIKE 'public.%';