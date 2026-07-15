CREATE OR REPLACE FUNCTION public.tg_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _op public.operacao_auditoria;
  _old JSONB; _new JSONB; _rid TEXT;
BEGIN
  IF TG_OP='INSERT' THEN
    _op:='insert'; _old:=NULL; _new:=to_jsonb(NEW);
    _rid := COALESCE(_new->>'id', _new->>'usuario_id' || ':' || _new->>'unidade_id', _new->>'usuario_id' || ':' || _new->>'secretaria_id');
  ELSIF TG_OP='UPDATE' THEN
    _op:='update'; _old:=to_jsonb(OLD); _new:=to_jsonb(NEW);
    _rid := COALESCE(_new->>'id', _new->>'usuario_id' || ':' || _new->>'unidade_id', _new->>'usuario_id' || ':' || _new->>'secretaria_id');
  ELSE
    _op:='delete'; _old:=to_jsonb(OLD); _new:=NULL;
    _rid := COALESCE(_old->>'id', _old->>'usuario_id' || ':' || _old->>'unidade_id', _old->>'usuario_id' || ':' || _old->>'secretaria_id');
  END IF;
  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, valor_anterior, valor_novo)
  VALUES (auth.uid(), _op, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, _rid, _old, _new);
  RETURN COALESCE(NEW, OLD);
END;
$function$;