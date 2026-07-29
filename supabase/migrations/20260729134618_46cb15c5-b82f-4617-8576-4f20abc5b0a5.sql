CREATE OR REPLACE FUNCTION public.mfa_exigido_nao_atendido(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
    -- só bloqueia quando o token declara explicitamente AAL1
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') = 'aal1'
    AND COALESCE((
      SELECT (
        COALESCE(p.admin_2fa_required, false)
        OR (u.acesso_todas_unidades AND u.acesso_todas_secretarias)
      )
      FROM public.usuarios u
      LEFT JOIN public.perfis p ON p.id = u.perfil_id
      WHERE u.id = _user_id AND u.deleted_at IS NULL
    ), false);
$function$;