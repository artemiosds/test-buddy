CREATE OR REPLACE FUNCTION public.tg_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _op public.operacao_auditoria;
  _old JSONB; _new JSONB; _rid TEXT; _src JSONB;
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

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, valor_anterior, valor_novo)
  VALUES (auth.uid(), _op, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, _rid, _old, _new);
  RETURN COALESCE(NEW, OLD);
END;
$function$;