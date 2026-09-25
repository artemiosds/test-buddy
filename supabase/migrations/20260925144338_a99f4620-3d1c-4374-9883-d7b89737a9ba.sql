DROP POLICY IF EXISTS "Consulta publica limitada para validacao" ON public.documentos_assinados;
REVOKE ALL PRIVILEGES ON public.documentos_assinados FROM anon;
DROP FUNCTION IF EXISTS public.validar_documento_publico(text);