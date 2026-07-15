DROP POLICY IF EXISTS pol_usuarios_gerenciar ON public.usuarios;
DROP POLICY IF EXISTS pol_usuarios_update_proprio ON public.usuarios;

CREATE POLICY pol_usuarios_master_manage
ON public.usuarios
FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS pol_usuario_permissoes_write ON public.usuario_permissoes;

CREATE POLICY pol_usuario_permissoes_master_write
ON public.usuario_permissoes
FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS pol_perfil_permissoes_write ON public.perfil_permissoes;

CREATE POLICY pol_perfil_permissoes_master_write
ON public.perfil_permissoes
FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));

DROP POLICY IF EXISTS pol_permissoes_write ON public.permissoes;

CREATE POLICY pol_permissoes_master_write
ON public.permissoes
FOR ALL
TO authenticated
USING (public.is_master(auth.uid()))
WITH CHECK (public.is_master(auth.uid()));