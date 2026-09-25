CREATE OR REPLACE FUNCTION public.validar_documento_publico(_codigo text)
RETURNS TABLE (
  id uuid,
  documento_tipo text,
  descricao text,
  hash_sha256 text,
  nome_assinante text,
  assinado_em timestamptz,
  status text,
  revogado_em timestamptz,
  motivo_revogacao text,
  codigo_validacao text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    d.id,
    d.documento_tipo,
    d.descricao,
    d.hash_sha256,
    d.nome_assinante,
    d.assinado_em,
    COALESCE(d.status, 'ativo'),
    d.revogado_em,
    d.motivo_revogacao,
    d.codigo_validacao
  FROM public.documentos_assinados d
  WHERE d.codigo_validacao = btrim(_codigo)
     OR d.id::text = btrim(_codigo)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validar_documento_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_documento_publico(text) TO anon, authenticated, service_role;