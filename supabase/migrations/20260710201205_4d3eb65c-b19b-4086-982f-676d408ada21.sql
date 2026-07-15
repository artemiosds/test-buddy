
CREATE TABLE IF NOT EXISTS public.tipos_unidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  deleted_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_unidade TO authenticated;
GRANT ALL ON public.tipos_unidade TO service_role;

ALTER TABLE public.tipos_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_unidade_select_auth"
  ON public.tipos_unidade FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "tipos_unidade_master_all"
  ON public.tipos_unidade FOR ALL TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

CREATE TRIGGER tg_tipos_unidade_updated_at
  BEFORE UPDATE ON public.tipos_unidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER tg_tipos_unidade_updated_by
  BEFORE INSERT OR UPDATE ON public.tipos_unidade
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

INSERT INTO public.tipos_unidade (nome)
SELECT DISTINCT trim(tipo_unidade)
FROM public.unidades
WHERE tipo_unidade IS NOT NULL AND trim(tipo_unidade) <> ''
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.tipos_unidade (nome)
VALUES ('UBS'), ('Hospital'), ('CAPS'), ('CER'), ('UPA'), ('Policlínica'), ('Farmácia Municipal'), ('Vigilância em Saúde')
ON CONFLICT (nome) DO NOTHING;
