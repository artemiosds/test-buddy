-- Unificar e conceder privilégios
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
      AND u.deleted_at IS NULL
      AND (
        p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER') 
        OR u.acesso_todas_unidades = true
        OR u.acesso_todas_secretarias = true
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_master_db(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  
  RETURN EXISTS (
    SELECT 1 
    FROM public.usuarios u
    LEFT JOIN public.perfis p ON u.perfil_id = p.id
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND (
        p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER') OR 
        u.acesso_todas_unidades = true OR
        u.acesso_todas_secretarias = true
      )
  );
END $function$;

-- Garantir EXECUTE explícito
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_db(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_profissional_complete(jsonb) TO authenticated;

-- Corrigir RLS de Escrita (Frequência Profissional) com Bypass Master
DROP POLICY IF EXISTS freq_prof_insert ON public.frequencia_profissional;
CREATE POLICY freq_prof_insert ON public.frequencia_profissional
FOR INSERT TO authenticated
WITH CHECK (
  is_master(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM frequencias f
    JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
    WHERE f.id = frequencia_profissional.frequencia_id 
    AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)
  )
);

DROP POLICY IF EXISTS freq_prof_update ON public.frequencia_profissional;
CREATE POLICY freq_prof_update ON public.frequencia_profissional
FOR UPDATE TO authenticated
USING (
  is_master(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM frequencias f
    JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
    WHERE f.id = frequencia_profissional.frequencia_id 
    AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)
  )
)
WITH CHECK (
  is_master(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM frequencias f
    JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
    WHERE f.id = frequencia_profissional.frequencia_id 
    AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)
  )
);

DROP POLICY IF EXISTS freq_prof_delete ON public.frequencia_profissional;
CREATE POLICY freq_prof_delete ON public.frequencia_profissional
FOR DELETE TO authenticated
USING (
  is_master(auth.uid()) OR
  EXISTS (
    SELECT 1 FROM frequencias f
    JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
    WHERE f.id = frequencia_profissional.frequencia_id 
    AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)
  )
);
