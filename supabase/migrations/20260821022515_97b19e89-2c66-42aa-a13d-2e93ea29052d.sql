DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT 
            p.proname,
            n.nspname,
            pg_get_function_identity_arguments(p.oid) as ident_args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND (
            p.proname LIKE '%summary%' OR 
            p.proname LIKE '%analytics%' OR 
            p.proname LIKE '%kpi%' OR 
            p.proname LIKE '%alert%' OR 
            p.proname LIKE '%dashboard%' OR
            p.proname LIKE 'compliance_riscos' OR
            p.proname LIKE 'get_organograma' OR
            p.proname LIKE 'list_profissionais'
        )
        AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION %I.%I(%s) SECURITY INVOKER', 
                       func_record.nspname, 
                       func_record.proname, 
                       func_record.ident_args);
    END LOOP;
END $$;