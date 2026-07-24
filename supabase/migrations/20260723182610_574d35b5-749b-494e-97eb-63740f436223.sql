CREATE OR REPLACE FUNCTION public.arquivar_profissional(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _sec uuid;
  _un uuid;
  _found boolean := false;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Requer autenticação' USING ERRCODE = '42501';
  END IF;

  SELECT p.secretaria_id, p.unidade_id, true
    INTO _sec, _un, _found
    FROM public.profissionais p
   WHERE p.id = _id
     AND p.deleted_at IS NULL;

  IF NOT COALESCE(_found, false) THEN
    RAISE EXCEPTION 'Profissional não encontrado' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    public.is_master(_caller)
    OR public.has_permission(_caller, 'profissional.excluir', _un, _sec)
    OR public.has_permission(_caller, 'profissional.editar', _un, _sec)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para arquivar profissional' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profissionais
     SET deleted_at = now(),
         deleted_by = _caller,
         updated_at = now(),
         updated_by = _caller
   WHERE id = _id
     AND deleted_at IS NULL;

  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, contexto)
  VALUES (
    _caller,
    'delete'::public.operacao_auditoria,
    'public.profissionais',
    _id::text,
    jsonb_build_object('acao', 'profissional.arquivar', 'origem', 'client')
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.arquivar_profissional(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';