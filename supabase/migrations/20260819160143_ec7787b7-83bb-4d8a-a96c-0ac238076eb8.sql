-- 1. IDENTIFICAR O VALOR DE auth.uid() DENTRO DA RPC
-- Vamos criar uma função temporária de debug para ver o UID da sessão no log do Supabase
CREATE OR REPLACE FUNCTION public.debug_rbac_caller()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_email TEXT;
BEGIN
    SELECT email INTO v_email FROM public.usuarios WHERE id = v_uid;
    RETURN jsonb_build_object(
        'uid', v_uid,
        'email', v_email,
        'is_master', public.is_master(v_uid),
        'is_master_db', public.is_master_db(v_uid)
    );
END;
$$;

-- 2. EXECUTAR O DEBUG
SELECT public.debug_rbac_caller();
