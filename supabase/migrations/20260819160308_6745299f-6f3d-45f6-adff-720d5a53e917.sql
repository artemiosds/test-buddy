-- 1. IDENTIFICAR O CULPADO: Por que o UID é nulo se estamos testando a RPC?
-- A RPC save_profissional_complete usa auth.uid() internamente.
-- Se o teste for feito via "supabase--read_query" ou "supabase--migration" sem setar a role da sessão, auth.uid() será null.
-- Contudo, o erro 42501 é disparado explicitamente pela lógica da função:
-- IF NOT COALESCE(v_is_master, false) THEN ... RAISE EXCEPTION 'Acesso negado' ...
-- Se v_uid é null, v_is_master é false, e a exceção é lançada.

-- 2. CORREÇÃO DE SEGURANÇA E ACESSO (Unificação Sem Falhas)
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND (
        u.acesso_todas_unidades = true
        OR u.acesso_todas_secretarias = true
        OR EXISTS (
          SELECT 1 FROM public.perfis p 
          WHERE p.id = u.perfil_id 
          AND p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER')
        )
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
    WHERE u.id = _user_id 
      AND u.deleted_at IS NULL
      AND (
        u.acesso_todas_unidades = true OR
        u.acesso_todas_secretarias = true OR
        EXISTS (
          SELECT 1 FROM public.perfis p 
          WHERE p.id = u.perfil_id 
          AND p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER')
        )
      )
  );
END $function$;

-- 3. BYPASS MASTER EM RLS (Escrita em Profissionais e Frequência)
DROP POLICY IF EXISTS profissionais_insert ON public.profissionais;
CREATE POLICY profissionais_insert ON public.profissionais FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.criar', unidade_id, secretaria_id)));

DROP POLICY IF EXISTS profissionais_update ON public.profissionais;
CREATE POLICY profissionais_update ON public.profissionais FOR UPDATE TO authenticated USING (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id))) WITH CHECK (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id)));

DROP POLICY IF EXISTS freq_prof_insert ON public.frequencia_profissional;
CREATE POLICY freq_prof_insert ON public.frequencia_profissional FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

DROP POLICY IF EXISTS freq_prof_update ON public.frequencia_profissional;
CREATE POLICY freq_prof_update ON public.frequencia_profissional FOR UPDATE TO authenticated USING (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id))) WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

-- 4. MANUTENÇÃO DE GRANTS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 5. TESTE DE NÃO-REGRESSÃO (Master by ID)
SELECT u.email, public.is_master(u.id) as r_sql, public.is_master_db(u.id) as r_pl
FROM public.usuarios u
WHERE u.id = 'cec0cbbf-eb2f-4985-a5d3-df79334dc32a';
