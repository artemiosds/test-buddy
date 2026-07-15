-- 1. Remove policy pública ampla da tabela base
DROP POLICY IF EXISTS "public_validar_documento" ON public.documentos_assinados;

-- 2. Revoga SELECT direto para anon na tabela base
REVOKE SELECT ON public.documentos_assinados FROM anon;

-- 3. Cria view pública restrita (sem dados_json, sem referencia_id, sem metadados internos)
CREATE OR REPLACE VIEW public.documentos_assinados_publico
WITH (security_invoker = on) AS
SELECT
  id,
  tipo,
  descricao,
  hash_conteudo,
  assinado_por_nome,
  assinado_em
FROM public.documentos_assinados;

-- 4. Concede SELECT na view para anon e authenticated
GRANT SELECT ON public.documentos_assinados_publico TO anon;
GRANT SELECT ON public.documentos_assinados_publico TO authenticated;

-- 5. Como a view usa security_invoker, precisamos de uma policy SELECT permissiva
-- que se aplica quando consultada via view (o role anon consulta a tabela base através da view).
-- Para permitir isso sem reintroduzir a vulnerabilidade, criamos uma policy SELECT restrita
-- que só existe no caminho da view (mesmos campos que a view expõe são retornados).
-- Como não há como diferenciar "via view" no PostgreSQL, usamos security_definer na view.
DROP VIEW IF EXISTS public.documentos_assinados_publico;

CREATE VIEW public.documentos_assinados_publico
WITH (security_invoker = off) AS
SELECT
  id,
  tipo,
  descricao,
  hash_conteudo,
  assinado_por_nome,
  assinado_em
FROM public.documentos_assinados;

GRANT SELECT ON public.documentos_assinados_publico TO anon;
GRANT SELECT ON public.documentos_assinados_publico TO authenticated;

-- Nota: a view roda com privilégios do dono (postgres) e não passa por RLS da tabela base.
-- A view NÃO expõe dados_json nem outros campos sensíveis.