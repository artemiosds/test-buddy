
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS admin_2fa_required boolean NOT NULL DEFAULT false;

UPDATE public.perfis
   SET admin_2fa_required = true
 WHERE codigo IN ('MASTER', 'ADMIN_SMS');

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS mfa_backup_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

DROP FUNCTION IF EXISTS public.get_my_user_context();

CREATE OR REPLACE FUNCTION public.get_my_user_context()
 RETURNS TABLE(
   id uuid,
   nome_completo text,
   email text,
   status public.status_usuario,
   perfil_id uuid,
   perfil_codigo text,
   perfil_nome text,
   secretaria_id uuid,
   acesso_todas_unidades boolean,
   acesso_todas_secretarias boolean,
   is_master boolean,
   perfil_admin_2fa_required boolean
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT u.id, u.nome_completo, u.email, u.status, u.perfil_id,
         p.codigo, p.nome,
         u.secretaria_id,
         u.acesso_todas_unidades, u.acesso_todas_secretarias,
         (u.acesso_todas_unidades AND u.acesso_todas_secretarias) AS is_master,
         COALESCE(p.admin_2fa_required, false) AS perfil_admin_2fa_required
  FROM public.usuarios u
  LEFT JOIN public.perfis p ON p.id = u.perfil_id
  WHERE u.id = auth.uid() AND u.deleted_at IS NULL;
$function$;
