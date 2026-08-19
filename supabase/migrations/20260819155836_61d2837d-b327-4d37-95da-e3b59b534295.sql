-- 1. IDENTIFICAR O CONTEXTO DE EXECUÇÃO DO DATA API
-- Se public.is_master(auth.uid()) falha com 42501 em uma query simples, 
-- o problema é a falta de permissão de EXECUTE para o papel da sessão.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- 2. UNIFICAÇÃO CONCEITUAL E SEGURANÇA (Sem e-mail bypass)
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

-- 3. BYPASS MASTER EM RLS (Escrita em Profissionais e Frequência)
-- Necessário para que a RPC SECURITY DEFINER funcione mesmo se o RLS restringir o caller.
DROP POLICY IF EXISTS profissionais_insert ON public.profissionais;
CREATE POLICY profissionais_insert ON public.profissionais FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.criar', unidade_id, secretaria_id)));

DROP POLICY IF EXISTS profissionais_update ON public.profissionais;
CREATE POLICY profissionais_update ON public.profissionais FOR UPDATE TO authenticated USING (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id))) WITH CHECK (is_master(auth.uid()) OR (user_has_secretaria(auth.uid(), secretaria_id) AND has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id)));

DROP POLICY IF EXISTS freq_prof_insert ON public.frequencia_profissional;
CREATE POLICY freq_prof_insert ON public.frequencia_profissional FOR INSERT TO authenticated WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

DROP POLICY IF EXISTS freq_prof_update ON public.frequencia_profissional;
CREATE POLICY freq_prof_update ON public.frequencia_profissional FOR UPDATE TO authenticated USING (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id))) WITH CHECK (is_master(auth.uid()) OR EXISTS (SELECT 1 FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id WHERE f.id = frequencia_profissional.frequencia_id AND has_permission(auth.uid(), 'frequencia.editar', cu.unidade_id)));

-- 4. PROVA TÉCNICA E TESTE DE SESSÃO
-- Esta query deve retornar o Master 'artemiosouza99@gmail.com' como Master=true.
SELECT u.id, u.email, public.is_master(u.id) as r_sql, public.is_master_db(u.id) as r_pl
FROM public.usuarios u
WHERE u.email = 'artemiosouza99@gmail.com';
