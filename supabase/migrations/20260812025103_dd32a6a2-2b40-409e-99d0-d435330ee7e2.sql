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
      -- O tipo final refletido no PDF depende do que foi encontrado na ativa
      CASE
        WHEN a.id IS NOT NULL THEN a.tipo
        ELSE reg.tipo_assinatura
      END AS tipo_assinatura,
      reg.ordem,
      reg.obrigatoria,
      a.id AS assinatura_id,
      a.titular_nome,
      a.titular_cargo,
      -- Prioridade de imagem:
      -- 1. Se a ativa tem imagem real (storage_path com '/'), usa ela.
      -- 2. Se a ativa nao tem (ex: assinatura eletronica sem PNG), busca o carimbo/imagem mais recente do mesmo titular.
      COALESCE(
        NULLIF(CASE WHEN position('/' in COALESCE(a.storage_path, '')) > 0 THEN a.storage_path ELSE '' END, ''),
        (
          SELECT f.storage_path
          FROM public.assinaturas_institucionais f
          WHERE f.usuario_id = a.usuario_id
            AND f.deleted_at IS NULL
            AND f.storage_path IS NOT NULL
            AND position('/' in f.storage_path) > 0
            AND f.tipo IN ('assinatura'::public.tipo_assinatura, 'carimbo'::public.tipo_assinatura)
            AND (f.vigencia_inicio IS NULL OR f.vigencia_inicio <= CURRENT_DATE)
            AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= CURRENT_DATE)
          ORDER BY f.ativa DESC, f.updated_at DESC NULLS LAST, f.created_at DESC
          LIMIT 1
        ),
        a.storage_path
      ) AS storage_path,
      CASE
        WHEN a.unidade_id = _unidade_id THEN 'unidade'
        WHEN a.secretaria_id = _secretaria_id THEN 'secretaria'
        WHEN a.secretaria_id IS NULL AND a.unidade_id IS NULL THEN 'global'
        ELSE 'ausente'
      END AS escopo,
      CASE
        WHEN a.unidade_id = _unidade_id THEN 1
        WHEN a.secretaria_id = _secretaria_id THEN 2
        WHEN a.secretaria_id IS NULL AND a.unidade_id IS NULL THEN 3
        ELSE 9
      END AS prioridade_escopo
    FROM regras reg
    LEFT JOIN public.assinaturas_institucionais a
      ON a.ativa = true
     AND a.deleted_at IS NULL
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
  ORDER BY m.perfil_codigo, m.ordem, m.prioridade_escopo;
END;
$function$;
