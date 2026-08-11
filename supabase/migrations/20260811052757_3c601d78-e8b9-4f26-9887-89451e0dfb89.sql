GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO service_role;

DROP POLICY IF EXISTS "Permitir leitura universal de usuarios para autenticados" ON public.usuarios;
DROP POLICY IF EXISTS "Permitir mutacao para administradores e master" ON public.usuarios;
DROP POLICY IF EXISTS "pol_usuarios_master_manage" ON public.usuarios;
DROP POLICY IF EXISTS "pol_usuarios_select" ON public.usuarios;

CREATE POLICY "usuarios_select_policy" ON public.usuarios
    FOR SELECT
    TO authenticated
    USING (
      (id = auth.uid()) 
      OR public.is_master(auth.uid()) 
      -- Regra adicional: se tiver permissão e pertencer à mesma secretaria
      OR (
        public.has_permission(auth.uid(), 'usuario.gerenciar') 
        AND secretaria_id IS NOT NULL 
        AND public.user_has_secretaria(auth.uid(), secretaria_id)
      )
    );

CREATE POLICY "usuarios_master_manage_policy" ON public.usuarios
    FOR ALL
    TO authenticated
    USING (public.is_master(auth.uid()))
    WITH CHECK (public.is_master(auth.uid()));