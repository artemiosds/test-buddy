-- Evolução do catálogo inteligente de layouts (aditivo, sem quebrar nada)

ALTER TABLE public.import_campo_aliases
  ADD COLUMN IF NOT EXISTS peso integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS usos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_uso timestamptz,
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual';

ALTER TABLE public.import_layout_campos
  ADD COLUMN IF NOT EXISTS condicional boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pesos jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.import_layouts
  ADD COLUMN IF NOT EXISTS classificacao text NOT NULL DEFAULT 'experimental';

ALTER TABLE public.import_layout_versoes
  ADD COLUMN IF NOT EXISTS regras jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.import_alias_sugestoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo text NOT NULL DEFAULT 'geral',
  campo_interno text NOT NULL,
  alias text NOT NULL,
  alias_norm text NOT NULL,
  confirmacoes integer NOT NULL DEFAULT 0,
  usuarios uuid[] NOT NULL DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'pendente',
  origem text NOT NULL DEFAULT 'manual',
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo, campo_interno, alias_norm)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_alias_sugestoes TO authenticated;
GRANT ALL ON public.import_alias_sugestoes TO service_role;

ALTER TABLE public.import_alias_sugestoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alias_sugestoes_select_auth ON public.import_alias_sugestoes;
CREATE POLICY alias_sugestoes_select_auth ON public.import_alias_sugestoes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS alias_sugestoes_insert_auth ON public.import_alias_sugestoes;
CREATE POLICY alias_sugestoes_insert_auth ON public.import_alias_sugestoes
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS alias_sugestoes_update_auth ON public.import_alias_sugestoes;
CREATE POLICY alias_sugestoes_update_auth ON public.import_alias_sugestoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS alias_sugestoes_delete_config ON public.import_alias_sugestoes;
CREATE POLICY alias_sugestoes_delete_config ON public.import_alias_sugestoes
  FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'configuracao.editar'::text, NULL::uuid, NULL::uuid));

DROP TRIGGER IF EXISTS set_updated_at_alias_sugestoes ON public.import_alias_sugestoes;
CREATE TRIGGER set_updated_at_alias_sugestoes
  BEFORE UPDATE ON public.import_alias_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_alias_sugestoes_modulo ON public.import_alias_sugestoes (modulo, status);