CREATE OR REPLACE FUNCTION public.get_assinaturas_documento(_tipo_documento text, _secretaria_id uuid DEFAULT NULL::uuid, _unidade_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(regra_id uuid, perfil_codigo text, tipo_assinatura tipo_assinatura, ordem integer, obrigatoria boolean, assinatura_id uuid, titular_nome text, titular_cargo text, storage_path text, escopo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH regras AS (
    SELECT DISTINCT ON (r.perfil_codigo, r.tipo_assinatura, r.ordem)
      r.id, r.perfil_codigo, r.tipo_assinatura, r.ordem, r.obrigatoria
    FROM public.assinatura_documento_regras r
    WHERE r.tipo_documento = _tipo_documento
      AND r.ativa = true
      AND (r.secretaria_id = _secretaria_id OR r.secretaria_id IS NULL)
    ORDER BY r.perfil_codigo, r.tipo_assinatura, r.ordem, (r.secretaria_id IS NOT NULL) DESC
  ),
  matches AS (
    SELECT
      reg.id AS regra_id,
      reg.perfil_codigo,
      CASE
        WHEN reg.tipo_assinatura = 'assinatura'::public.tipo_assinatura
          AND a.tipo = 'carimbo'::public.tipo_assinatura
        THEN 'carimbo'::public.tipo_assinatura
        ELSE reg.tipo_assinatura
      END AS tipo_assinatura,
      reg.ordem,
      reg.obrigatoria,
      a.id AS assinatura_id,
      a.titular_nome,
      a.titular_cargo,
      a.storage_path,
      CASE
        WHEN a.unidade_id = _unidade_id THEN 'unidade'
        WHEN a.secretaria_id = _secretaria_id THEN 'secretaria'
        WHEN a.secretaria_id IS NULL AND a.unidade_id IS NULL THEN 'global'
        ELSE 'ausente'
      END AS escopo,
      CASE
        WHEN a.storage_path IS NOT NULL AND position('/' in a.storage_path) > 0 THEN 0
        ELSE 1
      END AS prioridade_arquivo,
      CASE
        WHEN a.unidade_id = _unidade_id THEN 1
        WHEN a.secretaria_id = _secretaria_id THEN 2
        WHEN a.secretaria_id IS NULL AND a.unidade_id IS NULL THEN 3
        ELSE 9
      END AS prioridade_escopo,
      CASE
        WHEN reg.tipo_assinatura = 'assinatura'::public.tipo_assinatura
          AND a.tipo = 'carimbo'::public.tipo_assinatura THEN 0
        WHEN a.tipo = reg.tipo_assinatura THEN 1
        ELSE 9
      END AS prioridade_visual
    FROM regras reg
    LEFT JOIN public.assinaturas_institucionais a
      ON a.ativa = true
     AND a.deleted_at IS NULL
     AND (
       a.tipo = reg.tipo_assinatura
       OR (
         reg.tipo_assinatura = 'assinatura'::public.tipo_assinatura
         AND a.tipo = 'carimbo'::public.tipo_assinatura
       )
     )
     AND (
       (reg.perfil_codigo IS NOT NULL AND a.perfil_id = (
         SELECT p.id FROM public.perfis p WHERE p.codigo = reg.perfil_codigo LIMIT 1
       ))
       OR (reg.perfil_codigo IS NULL AND a.perfil_id IS NULL)
     )
     AND (
       a.unidade_id = _unidade_id
       OR (a.unidade_id IS NULL AND a.secretaria_id = _secretaria_id)
       OR (a.unidade_id IS NULL AND a.secretaria_id IS NULL)
     )
     AND (a.vigencia_inicio IS NULL OR a.vigencia_inicio <= CURRENT_DATE)
     AND (a.vigencia_fim IS NULL OR a.vigencia_fim >= CURRENT_DATE)
     AND (cardinality(a.tipos_documento) = 0 OR _tipo_documento = ANY(a.tipos_documento))
  )
  SELECT DISTINCT ON (m.perfil_codigo, m.ordem)
    m.regra_id,
    m.perfil_codigo,
    m.tipo_assinatura,
    m.ordem,
    m.obrigatoria,
    m.assinatura_id,
    m.titular_nome,
    m.titular_cargo,
    m.storage_path,
    m.escopo
  FROM matches m
  ORDER BY m.perfil_codigo, m.ordem, m.prioridade_arquivo, m.prioridade_escopo, m.prioridade_visual;
END;
$function$;