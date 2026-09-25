ALTER FUNCTION public.validar_documento_publico(text) SECURITY INVOKER;

GRANT SELECT (id, documento_tipo, descricao, hash_sha256, nome_assinante, assinado_em, status, revogado_em, motivo_revogacao, codigo_validacao)
ON public.documentos_assinados TO anon;

CREATE POLICY "Consulta publica limitada para validacao"
ON public.documentos_assinados
FOR SELECT
TO anon
USING (true);