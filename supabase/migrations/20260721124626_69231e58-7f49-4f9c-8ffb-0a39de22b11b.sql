
-- 1. Novas colunas em assinaturas_institucionais
ALTER TABLE public.assinaturas_institucionais
  ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS obrigatoria boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tipos_documento text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_assinaturas_perfil ON public.assinaturas_institucionais(perfil_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_assinaturas_tipos_doc ON public.assinaturas_institucionais USING GIN(tipos_documento);

COMMENT ON COLUMN public.assinaturas_institucionais.perfil_id IS 'Perfil funcional que assina (MASTER/GESTOR/DIRETOR_UNIDADE). NULL para logo/carimbo institucional.';
COMMENT ON COLUMN public.assinaturas_institucionais.ordem IS 'Ordem de aparição no PDF quando múltiplas assinaturas.';
COMMENT ON COLUMN public.assinaturas_institucionais.obrigatoria IS 'Se true e faltar, o PDF não é gerado.';
COMMENT ON COLUMN public.assinaturas_institucionais.tipos_documento IS 'Tipos de documento que essa assinatura atende (frequencia, folha_efetivos, folha_contratados, piso, relatorio). Vazio = todos.';

-- 2. Nova tabela: regras por tipo de documento
CREATE TABLE IF NOT EXISTS public.assinatura_documento_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_documento text NOT NULL,
  secretaria_id uuid REFERENCES public.secretarias(id) ON DELETE CASCADE,
  perfil_codigo text,
  tipo_assinatura public.tipo_assinatura NOT NULL DEFAULT 'assinatura',
  ordem integer NOT NULL DEFAULT 1,
  obrigatoria boolean NOT NULL DEFAULT true,
  observacao text,
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT chk_tipo_documento CHECK (tipo_documento IN ('frequencia','folha_efetivos','folha_contratados','piso','relatorio'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_regra_doc_perfil_sec
  ON public.assinatura_documento_regras (tipo_documento, COALESCE(secretaria_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(perfil_codigo, ''), tipo_assinatura, ordem)
  WHERE ativa = true;

CREATE INDEX IF NOT EXISTS idx_regras_tipo ON public.assinatura_documento_regras(tipo_documento) WHERE ativa = true;
CREATE INDEX IF NOT EXISTS idx_regras_secretaria ON public.assinatura_documento_regras(secretaria_id) WHERE ativa = true;

GRANT SELECT ON public.assinatura_documento_regras TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.assinatura_documento_regras TO authenticated;
GRANT ALL ON public.assinatura_documento_regras TO service_role;

ALTER TABLE public.assinatura_documento_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem consultar regras"
  ON public.assinatura_documento_regras
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Master gerencia regras"
  ON public.assinatura_documento_regras
  FOR ALL TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

CREATE TRIGGER trg_regras_updated_at
  BEFORE UPDATE ON public.assinatura_documento_regras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER trg_regras_updated_by
  BEFORE INSERT OR UPDATE ON public.assinatura_documento_regras
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- Seed padrão global
INSERT INTO public.assinatura_documento_regras (tipo_documento, perfil_codigo, tipo_assinatura, ordem, obrigatoria, observacao) VALUES
  ('frequencia', 'DIRETOR_UNIDADE', 'assinatura', 1, true, 'Diretor da Unidade assina a frequência mensal.'),
  ('frequencia', 'GESTOR', 'assinatura', 2, true, 'Gestor da Secretaria valida a frequência.'),
  ('folha_efetivos', 'DIRETOR_UNIDADE', 'assinatura', 1, true, 'Diretor da Unidade.'),
  ('folha_efetivos', 'GESTOR', 'assinatura', 2, true, 'Gestor / Secretário de Saúde.'),
  ('folha_efetivos', NULL, 'logo', 3, false, 'Brasão institucional.'),
  ('folha_contratados', 'DIRETOR_UNIDADE', 'assinatura', 1, true, 'Diretor da Unidade.'),
  ('folha_contratados', 'GESTOR', 'assinatura', 2, true, 'Gestor / Secretário de Saúde.'),
  ('folha_contratados', NULL, 'logo', 3, false, 'Brasão institucional.'),
  ('piso', 'GESTOR', 'assinatura', 1, true, 'Gestor / Secretário de Saúde.'),
  ('piso', NULL, 'logo', 2, false, 'Brasão institucional.'),
  ('relatorio', 'GESTOR', 'assinatura', 1, true, 'Gestor / Secretário de Saúde.'),
  ('relatorio', NULL, 'logo', 2, false, 'Brasão institucional.')
ON CONFLICT DO NOTHING;

-- 3. Função de resolução hierárquica
CREATE OR REPLACE FUNCTION public.get_assinaturas_documento(
  _tipo_documento text,
  _secretaria_id uuid DEFAULT NULL,
  _unidade_id uuid DEFAULT NULL
)
RETURNS TABLE (
  regra_id uuid,
  perfil_codigo text,
  tipo_assinatura public.tipo_assinatura,
  ordem integer,
  obrigatoria boolean,
  assinatura_id uuid,
  titular_nome text,
  titular_cargo text,
  storage_path text,
  escopo text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  match AS (
    SELECT
      reg.id AS regra_id,
      reg.perfil_codigo,
      reg.tipo_assinatura,
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
        WHEN a.unidade_id = _unidade_id THEN 1
        WHEN a.secretaria_id = _secretaria_id THEN 2
        WHEN a.secretaria_id IS NULL AND a.unidade_id IS NULL THEN 3
        ELSE 9
      END AS prioridade
    FROM regras reg
    LEFT JOIN public.assinaturas_institucionais a
      ON a.ativa = true
     AND a.deleted_at IS NULL
     AND a.tipo = reg.tipo_assinatura
     AND (
       (reg.perfil_codigo IS NOT NULL AND a.perfil_id = (SELECT id FROM public.perfis WHERE codigo = reg.perfil_codigo LIMIT 1))
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
  SELECT DISTINCT ON (m.perfil_codigo, m.tipo_assinatura, m.ordem)
    m.regra_id, m.perfil_codigo, m.tipo_assinatura, m.ordem, m.obrigatoria,
    m.assinatura_id, m.titular_nome, m.titular_cargo, m.storage_path, m.escopo
  FROM match m
  ORDER BY m.perfil_codigo, m.tipo_assinatura, m.ordem, m.prioridade;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_assinaturas_documento(text, uuid, uuid) TO authenticated;
