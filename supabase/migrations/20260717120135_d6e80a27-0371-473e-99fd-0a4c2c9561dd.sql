-- 5C.2: estreitar visibilidade de usuario.gerenciar por secretaria

-- 1) usuarios: SELECT escopado por secretaria do usuário-alvo
DROP POLICY IF EXISTS pol_usuarios_select ON public.usuarios;
CREATE POLICY pol_usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_master(auth.uid())
    OR (
      public.has_permission(auth.uid(), 'usuario.gerenciar')
      AND secretaria_id IS NOT NULL
      AND public.user_has_secretaria(auth.uid(), secretaria_id)
    )
  );

-- 2) usuario_permissoes: SELECT escopado pela secretaria do usuário-alvo
DROP POLICY IF EXISTS pol_usuario_permissoes_select ON public.usuario_permissoes;
CREATE POLICY pol_usuario_permissoes_select ON public.usuario_permissoes
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid()
    OR public.is_master(auth.uid())
    OR (
      public.has_permission(auth.uid(), 'usuario.gerenciar')
      AND EXISTS (
        SELECT 1
        FROM public.usuarios u
        WHERE u.id = usuario_permissoes.usuario_id
          AND u.secretaria_id IS NOT NULL
          AND public.user_has_secretaria(auth.uid(), u.secretaria_id)
      )
    )
  );