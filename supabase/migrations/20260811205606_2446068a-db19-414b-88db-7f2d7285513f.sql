
CREATE OR REPLACE FUNCTION public.get_my_user_context()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _user_id uuid := auth.uid();
  _res jsonb;
BEGIN
  IF _user_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'nome_completo', u.nome_completo,
    'email', u.email::text,
    'status', u.status,
    'perfil_id', u.perfil_id,
    'perfil_codigo', p.codigo,
    'perfil_nome', p.nome,
    'secretaria_id', u.secretaria_id,
    'acesso_todas_unidades', u.acesso_todas_unidades,
    'acesso_todas_secretarias', u.acesso_todas_secretarias,
    'is_master', public.is_master(u.id),
    'perfil_admin_2fa_required', COALESCE(p.admin_2fa_required, false),
    'unidades', COALESCE((
      SELECT jsonb_agg(unidade_id)
      FROM public.usuario_unidades
      WHERE usuario_id = u.id AND deleted_at IS NULL
        AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
    ), '[]'::jsonb),
    -- Novos campos adicionados para Assinatura Institucional
    'cpf', (SELECT pr.cpf FROM public.profissionais pr WHERE pr.user_id = u.id LIMIT 1),
    'matricula', (SELECT pr.matricula FROM public.profissionais pr WHERE pr.user_id = u.id LIMIT 1)
  ) INTO _res
  FROM public.usuarios u
  LEFT JOIN public.perfis p ON u.perfil_id = p.id
  WHERE u.id = _user_id AND u.deleted_at IS NULL;

  RETURN _res;
END $function$;
