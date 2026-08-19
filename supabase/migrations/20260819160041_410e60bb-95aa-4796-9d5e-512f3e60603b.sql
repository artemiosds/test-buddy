-- 1. CORREÇÃO RADICAL DE GRANTS
-- O problema principal parece ser que o usuário da sessão (Data API / PostgREST) não tem permissão para ler tabelas
-- necessárias dentro da lógica SECURITY DEFINER, ou o esquema public está bloqueado.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 2. UNIFICAR FUNÇÕES COM LÓGICA ROBUSTA (Sem JOIN se possível, ou usando LEFT JOIN)
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

-- 3. TESTAR DIRETAMENTE O MASTER COM ID
SELECT u.email, public.is_master('cec0cbbf-eb2f-4985-a5d3-df79334dc32a') as test_val
FROM public.usuarios u WHERE u.id = 'cec0cbbf-eb2f-4985-a5d3-df79334dc32a';
