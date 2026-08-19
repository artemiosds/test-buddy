-- 1. IDENTIFICAR O CULPADO: Por que o Master recebe "permission denied for function is_master"?
-- O erro 42501 sugere que, embora a função seja SECURITY DEFINER, o USÁRIO DA SESSÃO (Data API)
-- não tem permissão de EXECUTE, ou o schema está bloqueado.
-- Mas o linter diz que "Public Can Execute", o que é contraditório se falha com 42501.

-- VAMOS GARANTIR OS GRANTS DE FORMA AGRESSIVA PARA O SCHEMA PUBLIC
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 2. UNIFICAR E CORRIGIR (Removendo email bypass conforme instrução)
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
    LEFT JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND (
        p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER') OR 
        u.acesso_todas_unidades = true OR
        u.acesso_todas_secretarias = true
      )
  );
END $function$;

-- 3. BYPASS MASTER EM RLS (Escrita em Frequência)
DROP POLICY IF EXISTS freq_prof_insert ON public.frequencia_profissional;
CREATE POLICY freq_prof_insert ON public.frequencia_profissional FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

DROP POLICY IF EXISTS freq_prof_update ON public.frequencia_profissional;
CREATE POLICY freq_prof_update ON public.frequencia_profissional FOR UPDATE TO authenticated USING (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id))) WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

DROP POLICY IF EXISTS freq_prof_delete ON public.frequencia_profissional;
CREATE POLICY freq_prof_delete ON public.frequencia_profissional FOR DELETE TO authenticated USING (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

-- 4. TESTE TÉCNICO DE CONTEXTO (Provar que o Master cec0cbbf... é reconhecido)
SELECT u.id, u.email, public.is_master(u.id) as res_sql, public.is_master_db(u.id) as res_pl
FROM public.usuarios u
WHERE u.id = 'cec0cbbf-eb2f-4985-a5d3-df79334dc32a';
