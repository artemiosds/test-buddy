CREATE OR REPLACE FUNCTION public.mfa_exigido_nao_atendido(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated'
    AND COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') = 'aal1'
    -- só bloqueia se a pessoa JÁ possui um fator verificado (senão ficaria travada sem saída)
    AND EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = _user_id AND f.status = 'verified'
    )
    AND COALESCE((
      SELECT (
        COALESCE(p.admin_2fa_required, false)
        OR (u.acesso_todas_unidades AND u.acesso_todas_secretarias)
      )
      FROM public.usuarios u
      LEFT JOIN public.perfis p ON p.id = u.perfil_id
      WHERE u.id = _user_id AND u.deleted_at IS NULL
    ), false);
$$;