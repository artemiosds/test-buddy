
-- 1) Dados bancários no cadastro do profissional
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS agencia TEXT,
  ADD COLUMN IF NOT EXISTS conta_corrente TEXT;

-- 2) Tabela de frequência de contratados (modelo HMO)
CREATE TABLE IF NOT EXISTS public.frequencias_contratados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia_id UUID NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,

  dias_falta NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (dias_falta >= 0),
  atestado NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (atestado >= 0),
  he_50 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (he_50 >= 0),
  he_100 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (he_100 >= 0),
  adn NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (adn >= 0),
  plantoes NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (plantoes >= 0),
  sobreaviso NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (sobreaviso >= 0),
  incentivo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (incentivo >= 0),

  observacoes TEXT,
  status public.status_frequencia NOT NULL DEFAULT 'rascunho',

  enviada_em TIMESTAMPTZ,
  enviada_por UUID,
  aprovada_em TIMESTAMPTZ,
  aprovada_por UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,

  UNIQUE (competencia_id, unidade_id, profissional_id)
);

CREATE INDEX IF NOT EXISTS idx_freq_contratados_comp_unid
  ON public.frequencias_contratados (competencia_id, unidade_id);
CREATE INDEX IF NOT EXISTS idx_freq_contratados_prof
  ON public.frequencias_contratados (profissional_id);

-- 3) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias_contratados TO authenticated;
GRANT ALL ON public.frequencias_contratados TO service_role;

-- 4) RLS
ALTER TABLE public.frequencias_contratados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freq_contratados_select" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_select" ON public.frequencias_contratados
  FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_contratados_insert" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_insert" ON public.frequencias_contratados
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_contratados_update" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_update" ON public.frequencias_contratados
  FOR UPDATE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  )
  WITH CHECK (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_contratados_delete" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_delete" ON public.frequencias_contratados
  FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));

-- 5) Triggers padrão
DROP TRIGGER IF EXISTS trg_freq_contratados_updated_at ON public.frequencias_contratados;
CREATE TRIGGER trg_freq_contratados_updated_at
  BEFORE UPDATE ON public.frequencias_contratados
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_freq_contratados_updated_by ON public.frequencias_contratados;
CREATE TRIGGER trg_freq_contratados_updated_by
  BEFORE INSERT OR UPDATE ON public.frequencias_contratados
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

DROP TRIGGER IF EXISTS trg_freq_contratados_audit ON public.frequencias_contratados;
CREATE TRIGGER trg_freq_contratados_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.frequencias_contratados
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
