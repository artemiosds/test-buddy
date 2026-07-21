DROP VIEW IF EXISTS public.documentos_assinados_publico;
CREATE VIEW public.documentos_assinados_publico
WITH (security_invoker = true) AS
SELECT id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em,
       status, revogado_em, motivo_revogacao, timestamp_confiavel,
       termo_aceite
FROM public.documentos_assinados;

GRANT SELECT ON public.documentos_assinados_publico TO anon, authenticated;