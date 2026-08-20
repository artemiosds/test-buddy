
-- 1. Unificação da lógica MASTER (Função central para RLS)
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND (
        u.acesso_todas_unidades = true
        OR u.acesso_todas_secretarias = true
        OR p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'ADMIN_MASTER', 'SUPERMASTER')
      )
  );
$$;

-- 2. Unificação da lógica MASTER para DB (Função central para RPCs/Logic)
CREATE OR REPLACE FUNCTION public.is_master_db(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Simplesmente chama a função oficial para garantir 100% de consistência
  SELECT public.is_master(_user_id);
$$;

-- 3. Atualização da função current_user_is_master para usar a lógica unificada
CREATE OR REPLACE FUNCTION public.current_user_is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_master(auth.uid());
$$;

-- 4. Correção das políticas de RLS de Frequência Profissional (INSERT/UPDATE/DELETE)
DROP POLICY IF EXISTS "freq_prof_insert_master_or_scoped" ON public.frequencia_profissional;
DROP POLICY IF EXISTS "freq_prof_update_master_or_scoped" ON public.frequencia_profissional;
DROP POLICY IF EXISTS "freq_prof_delete_master_or_scoped" ON public.frequencia_profissional;

CREATE POLICY "freq_prof_insert_master_or_scoped" ON public.frequencia_profissional
FOR INSERT TO authenticated
WITH CHECK (
    public.is_master(auth.uid()) 
    OR EXISTS (
        SELECT 1 FROM frequencias f
        JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
        WHERE f.id = frequencia_profissional.frequencia_id
        AND cu.unidade_id IN (SELECT unidade_id FROM public.current_user_unidades())
    )
);

CREATE POLICY "freq_prof_update_master_or_scoped" ON public.frequencia_profissional
FOR UPDATE TO authenticated
USING (
    public.is_master(auth.uid()) 
    OR EXISTS (
        SELECT 1 FROM frequencias f
        JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
        WHERE f.id = frequencia_profissional.frequencia_id
        AND cu.unidade_id IN (SELECT unidade_id FROM public.current_user_unidades())
    )
)
WITH CHECK (
    public.is_master(auth.uid()) 
    OR EXISTS (
        SELECT 1 FROM frequencias f
        JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
        WHERE f.id = frequencia_profissional.frequencia_id
        AND cu.unidade_id IN (SELECT unidade_id FROM public.current_user_unidades())
    )
);

CREATE POLICY "freq_prof_delete_master_or_scoped" ON public.frequencia_profissional
FOR DELETE TO authenticated
USING (
    public.is_master(auth.uid()) 
    OR EXISTS (
        SELECT 1 FROM frequencias f
        JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
        WHERE f.id = frequencia_profissional.frequencia_id
        AND cu.unidade_id IN (SELECT unidade_id FROM public.current_user_unidades())
    )
);

-- 5. Garantir que as políticas de 'perfis' permitam leitura por todos os autenticados
DROP POLICY IF EXISTS "perfis_select_scoped" ON public.perfis;
CREATE POLICY "perfis_select_scoped" ON public.perfis
FOR SELECT TO authenticated
USING (true);

-- 6. Recriar current_user_unidades para garantir que o Master veja TUDO
CREATE OR REPLACE FUNCTION public.current_user_unidades()
RETURNS TABLE(unidade_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Master: devolve todas as unidades
  SELECT un.id AS unidade_id
  FROM public.unidades un
  WHERE public.is_master(auth.uid())

  UNION

  -- Não-Master: devolve as unidades vinculadas ao usuário
  SELECT uu.unidade_id
  FROM public.usuario_unidades uu
  WHERE uu.usuario_id = auth.uid()
    AND (
      -- prioridade para principal se houver
      uu.is_principal = true
      OR NOT EXISTS (
        SELECT 1
        FROM public.usuario_unidades uu2
        WHERE uu2.usuario_id = auth.uid()
          AND uu2.is_principal = true
      )
    );
$$;
