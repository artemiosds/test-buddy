-- RPC helpers para o cliente carregar contexto do usuário e permissões efetivas

-- Retorna o conjunto de códigos de permissão efetivos do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS SETOF text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH me AS (
    SELECT u.id, u.perfil_id, u.status, u.deleted_at,
           (u.acesso_todas_unidades AND u.acesso_todas_secretarias) AS is_master
    FROM public.usuarios u
    WHERE u.id = auth.uid()
  )
  SELECT p.codigo
  FROM public.permissoes p, me
  WHERE p.ativa = true
    AND p.deleted_at IS NULL
    AND me.deleted_at IS NULL
    AND me.status = 'ativo'
    AND (
      me.is_master
      OR (
        -- concessão individual válida
        EXISTS (
          SELECT 1 FROM public.usuario_permissoes up
          WHERE up.usuario_id = me.id
            AND up.permissao_id = p.id
            AND up.tipo = 'concedida'
            AND up.deleted_at IS NULL
            AND up.valido_de <= now()
            AND (up.valido_ate IS NULL OR up.valido_ate > now())
        )
        OR (
          -- concessão via perfil
          EXISTS (
            SELECT 1 FROM public.perfil_permissoes pp
            WHERE pp.perfil_id = me.perfil_id
              AND pp.permissao_id = p.id
              AND pp.concedida = true
          )
          -- e sem revogação individual ativa
          AND NOT EXISTS (
            SELECT 1 FROM public.usuario_permissoes up2
            WHERE up2.usuario_id = me.id
              AND up2.permissao_id = p.id
              AND up2.tipo = 'revogada'
              AND up2.deleted_at IS NULL
              AND up2.valido_de <= now()
              AND (up2.valido_ate IS NULL OR up2.valido_ate > now())
          )
        )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- Retorna contexto do usuário autenticado (dados + perfil + flag master)
CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS TABLE (
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
  is_master boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.nome_completo, u.email, u.status, u.perfil_id,
         p.codigo, p.nome,
         u.secretaria_id,
         u.acesso_todas_unidades, u.acesso_todas_secretarias,
         (u.acesso_todas_unidades AND u.acesso_todas_secretarias) AS is_master
  FROM public.usuarios u
  LEFT JOIN public.perfis p ON p.id = u.perfil_id
  WHERE u.id = auth.uid() AND u.deleted_at IS NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
