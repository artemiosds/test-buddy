DROP TABLE IF EXISTS public.documentos_assinados CASCADE;

CREATE TABLE public.documentos_assinados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo_validacao VARCHAR(32) UNIQUE NOT NULL,
    frequencia_id UUID REFERENCES public.frequencias(id) ON DELETE CASCADE,
    documento_tipo VARCHAR(50) NOT NULL DEFAULT 'folha_frequencia',
    hash_sha256 TEXT NOT NULL,
    assinado_por_id UUID REFERENCES auth.users(id),
    nome_assinante VARCHAR(255) NOT NULL,
    cargo_assinante VARCHAR(255),
    ip_address TEXT,
    user_agent TEXT,
    assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT ON public.documentos_assinados TO authenticated;
GRANT SELECT ON public.documentos_assinados TO anon;
GRANT ALL ON public.documentos_assinados TO service_role;

ALTER TABLE public.documentos_assinados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir consulta publica de validade" 
ON public.documentos_assinados 
FOR SELECT 
TO anon, authenticated 
USING (true);

CREATE POLICY "Permitir insercao por usuarios autenticados" 
ON public.documentos_assinados 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = assinado_por_id);

CREATE INDEX idx_doc_ass_codigo ON public.documentos_assinados(codigo_validacao);
CREATE INDEX idx_doc_ass_hash ON public.documentos_assinados(hash_sha256);
