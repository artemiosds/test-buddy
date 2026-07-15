
CREATE TABLE public.documentos_assinados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  referencia_id UUID,
  descricao TEXT NOT NULL,
  hash_conteudo TEXT NOT NULL,
  dados_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  assinado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  assinado_por_nome TEXT,
  assinado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_docass_ref ON public.documentos_assinados(tipo, referencia_id);

GRANT SELECT ON public.documentos_assinados TO anon;
GRANT SELECT, INSERT ON public.documentos_assinados TO authenticated;
GRANT ALL ON public.documentos_assinados TO service_role;

ALTER TABLE public.documentos_assinados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_validar_documento" ON public.documentos_assinados
  FOR SELECT TO anon USING (true);

CREATE POLICY "authenticated_ver_documentos" ON public.documentos_assinados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_inserir_documentos" ON public.documentos_assinados
  FOR INSERT TO authenticated WITH CHECK (assinado_por = auth.uid());
