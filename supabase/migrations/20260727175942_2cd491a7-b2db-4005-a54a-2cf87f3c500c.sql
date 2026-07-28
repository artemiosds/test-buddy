-- =====================================================================
-- MOTOR DE LAYOUTS DE IMPORTAÇÃO (genérico / reutilizável por módulo)
-- =====================================================================

CREATE TABLE public.import_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL DEFAULT 'planilha',
  modulo text NOT NULL DEFAULT 'geral',
  ativo boolean NOT NULL DEFAULT true,
  versao_atual integer NOT NULL DEFAULT 1,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_layouts TO authenticated;
GRANT ALL ON public.import_layouts TO service_role;
ALTER TABLE public.import_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layouts_select_auth" ON public.import_layouts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "layouts_write_config" ON public.import_layouts
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

-- ---------------------------------------------------------------------

CREATE TABLE public.import_layout_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid NOT NULL REFERENCES public.import_layouts(id) ON DELETE CASCADE,
  versao integer NOT NULL,
  situacao text NOT NULL DEFAULT 'ativa',
  notas text,
  arquivo_hints text[] NOT NULL DEFAULT '{}',
  header_hints text[] NOT NULL DEFAULT '{}',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (layout_id, versao)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_layout_versoes TO authenticated;
GRANT ALL ON public.import_layout_versoes TO service_role;
ALTER TABLE public.import_layout_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layout_versoes_select_auth" ON public.import_layout_versoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "layout_versoes_write_config" ON public.import_layout_versoes
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

CREATE INDEX idx_layout_versoes_layout ON public.import_layout_versoes(layout_id, versao DESC);

-- ---------------------------------------------------------------------

CREATE TABLE public.import_layout_campos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  versao_id uuid NOT NULL REFERENCES public.import_layout_versoes(id) ON DELETE CASCADE,
  campo_interno text NOT NULL,
  label text,
  coluna_padrao text,
  aliases text[] NOT NULL DEFAULT '{}',
  obrigatorio boolean NOT NULL DEFAULT false,
  ignorado boolean NOT NULL DEFAULT false,
  tipo_dado text NOT NULL DEFAULT 'texto',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (versao_id, campo_interno)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_layout_campos TO authenticated;
GRANT ALL ON public.import_layout_campos TO service_role;
ALTER TABLE public.import_layout_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layout_campos_select_auth" ON public.import_layout_campos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "layout_campos_write_config" ON public.import_layout_campos
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

CREATE INDEX idx_layout_campos_versao ON public.import_layout_campos(versao_id, ordem);

-- ---------------------------------------------------------------------
-- Catálogo global de sinônimos (independente de layout)

CREATE TABLE public.import_campo_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL DEFAULT 'geral',
  campo_interno text NOT NULL,
  alias text NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo, campo_interno, alias)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_campo_aliases TO authenticated;
GRANT ALL ON public.import_campo_aliases TO service_role;
ALTER TABLE public.import_campo_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campo_aliases_select_auth" ON public.import_campo_aliases
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "campo_aliases_write_config" ON public.import_campo_aliases
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

-- ---------------------------------------------------------------------
-- Histórico de utilização (auditoria do motor)

CREATE TABLE public.import_layout_uso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layout_id uuid REFERENCES public.import_layouts(id) ON DELETE SET NULL,
  versao_id uuid REFERENCES public.import_layout_versoes(id) ON DELETE SET NULL,
  layout_codigo text,
  versao integer,
  modulo text NOT NULL DEFAULT 'geral',
  historico_id uuid,
  usuario_id uuid NOT NULL DEFAULT auth.uid(),
  nome_arquivo text,
  competencia text,
  total_linhas integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.import_layout_uso TO authenticated;
GRANT ALL ON public.import_layout_uso TO service_role;
ALTER TABLE public.import_layout_uso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "layout_uso_select_auth" ON public.import_layout_uso
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "layout_uso_insert_self" ON public.import_layout_uso
  FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());

CREATE INDEX idx_layout_uso_created ON public.import_layout_uso(created_at DESC);

-- ---------------------------------------------------------------------
-- updated_at

CREATE TRIGGER trg_import_layouts_updated
  BEFORE UPDATE ON public.import_layouts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_import_layout_versoes_updated
  BEFORE UPDATE ON public.import_layout_versoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_import_layout_campos_updated
  BEFORE UPDATE ON public.import_layout_campos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();