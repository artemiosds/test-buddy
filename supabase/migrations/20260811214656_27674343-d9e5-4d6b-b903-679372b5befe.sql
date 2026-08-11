CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _result jsonb;
  _is_master boolean;
  _unidades jsonb;
  _email_caller text;
BEGIN
  IF _caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1. Buscar dados do usuário e email
  SELECT 
    email,
    COALESCE((acesso_todas_unidades AND acesso_todas_secretarias), false)
  INTO _email_caller, _is_master
  FROM public.usuarios
  WHERE id = _caller AND deleted_at IS NULL AND status = 'ativo';

  -- 2. Resolver is_master com MFA gate
  IF public.mfa_exigido_nao_atendido_core(_caller) THEN
    _is_master := false;
  END IF;

  -- 3. Buscar unidades autorizadas
  SELECT COALESCE(
    jsonb_agg(DISTINCT uu.unidade_id),
    '[]'::jsonb
  ) INTO _unidades
  FROM public.usuario_unidades uu
  WHERE uu.usuario_id = _caller
    AND uu.deleted_at IS NULL
    AND (uu.data_fim IS NULL OR uu.data_fim >= CURRENT_DATE);

  -- 4. Montar resultado JSONB final
  -- A ligação é feita pelo email, já que profissionais não tem FK para usuarios.id mas compartilha o email.
  SELECT jsonb_build_object(
    'id', u.id,
    'nome_completo', u.nome_completo,
    'email', u.email,
    'status', u.status,
    'perfil_id', u.perfil_id,
    'perfil_codigo', p.codigo,
    'perfil_nome', p.nome,
    'secretaria_id', u.secretaria_id,
    'acesso_todas_unidades', COALESCE(u.acesso_todas_unidades, false),
    'acesso_todas_secretarias', COALESCE(u.acesso_todas_secretarias, false),
    'is_master', COALESCE(_is_master, false),
    'perfil_admin_2fa_required', COALESCE(p.admin_2fa_required, false),
    'unidades', COALESCE(_unidades, '[]'::jsonb),
    'cpf', (SELECT pr.cpf FROM public.profissionais pr WHERE pr.email = u.email AND pr.deleted_at IS NULL LIMIT 1),
    'matricula', (SELECT pr.matricula FROM public.profissionais pr WHERE pr.email = u.email AND pr.deleted_at IS NULL LIMIT 1)
  ) INTO _result
  FROM public.usuarios u
  LEFT JOIN public.perfis p ON u.perfil_id = p.id
  WHERE u.id = _caller
    AND u.deleted_at IS NULL
    AND u.status = 'ativo';

  RETURN _result;
END $function$;