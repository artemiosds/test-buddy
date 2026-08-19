-- 1. Reforçar is_master com fail-safe para o e-mail master e flag de acesso global
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id 
      AND (
        p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER') 
        OR u.acesso_todas_unidades = true
        OR u.email = 'artemiosouza99@gmail.com' -- Hardcoded fail-safe para o master principal
      )
      AND u.deleted_at IS NULL
  );
$function$;

-- 2. Garantir que as políticas de unidades permitam SELECT pelo Master sem joins circulares
DROP POLICY IF EXISTS "unidades_select" ON public.unidades;
DROP POLICY IF EXISTS "unidades_select_master_v3" ON public.unidades;
CREATE POLICY "unidades_select_master_v3" ON public.unidades
FOR SELECT TO authenticated
USING (
  public.is_master(auth.uid()) 
  OR (deleted_at IS NULL AND (
    EXISTS (SELECT 1 FROM public.usuario_unidades uu WHERE uu.usuario_id = auth.uid() AND uu.unidade_id = unidades.id)
    OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
  ))
);

-- 3. Corrigir metadados (nome da coluna é raw_app_meta_data com underline extra em algumas versões do auth)
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('is_master', true)
WHERE email = 'artemiosouza99@gmail.com';

UPDATE public.usuarios 
SET acesso_todas_unidades = true 
WHERE email = 'artemiosouza99@gmail.com';
