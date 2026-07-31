CREATE TABLE public.planilha_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  modulo text NOT NULL DEFAULT 'piso',
  vinculo text,
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
  nome_arquivo text NOT NULL DEFAULT '',
  aba text NOT NULL DEFAULT '',
  linha_cabecalho integer NOT NULL DEFAULT 1,
  colunas jsonb NOT NULL DEFAULT '[]'::jsonb,
  colunas_estruturais jsonb NOT NULL DEFAULT '[]'::jsonb,
  arquivo_base64 text NOT NULL,
  bytes integer NOT NULL DEFAULT 0,
  padrao boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX planilha_modelos_padrao_uk
  ON public.planilha_modelos (modulo, coalesce(vinculo, ''), coalesce(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE padrao AND ativo;

CREATE INDEX planilha_modelos_lookup_idx ON public.planilha_modelos (modulo, vinculo, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planilha_modelos TO authenticated;
GRANT ALL ON public.planilha_modelos TO service_role;

ALTER TABLE public.planilha_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY planilha_modelos_select ON public.planilha_modelos
  FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.visualizar', NULL, NULL)
         OR public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

CREATE POLICY planilha_modelos_write ON public.planilha_modelos
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL))
  WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

CREATE TRIGGER planilha_modelos_set_updated_at
  BEFORE UPDATE ON public.planilha_modelos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();