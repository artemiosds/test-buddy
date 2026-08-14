-- Proteção de arquivos de assinatura em uso por documentos históricos
-- Esta função verifica se um caminho de storage está sendo referenciado em snapshots de assinatura
-- ou em metadados de documentos já emitidos.

CREATE OR REPLACE FUNCTION public.assinatura_em_uso(_storage_path text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_clean_path text;
    v_in_snapshot boolean;
    v_in_documento boolean;
BEGIN
    -- Remove leading slashes para comparação consistente
    v_clean_path := ltrim(_storage_path, '/');

    -- 1. Verifica na tabela de snapshots de frequências
    SELECT EXISTS (
        SELECT 1 
        FROM public.frequencia_assinaturas_snapshot 
        WHERE ltrim(storage_path, '/') = v_clean_path
    ) INTO v_in_snapshot;

    IF v_in_snapshot THEN
        RETURN true;
    END IF;

    -- 2. Verifica na tabela de documentos assinados
    -- Auditoria do pdf-pipeline.ts mostrou que 'filename' é salvo, mas não o path da assinatura.
    -- Contudo, snapshots históricos são a fonte da verdade para frequências.
    -- Se futuramente o pdf-pipeline gravar 'assinatura_path', esta função já o protege.
    SELECT EXISTS (
        SELECT 1 
        FROM public.documentos_assinados
        WHERE (dados_json->>'storage_path' IS NOT NULL AND ltrim(dados_json->>'storage_path', '/') = v_clean_path)
           OR (dados_json->>'assinatura_path' IS NOT NULL AND ltrim(dados_json->>'assinatura_path', '/') = v_clean_path)
    ) INTO v_in_documento;

    RETURN v_in_documento;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assinatura_em_uso(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinatura_em_uso(text) TO service_role;

-- Política de RLS no Storage para impedir DELETE de arquivos em uso no bucket 'assinaturas'
DO $$
BEGIN
    DROP POLICY IF EXISTS "Proteção de assinaturas em uso" ON storage.objects;
    
    CREATE POLICY "Proteção de assinaturas em uso"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'assinaturas' 
        AND NOT public.assinatura_em_uso(name)
    );
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Tabela storage.objects não encontrada. Certifique-se que o Storage está habilitado.';
END $$;
