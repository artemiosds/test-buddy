
-- 1) Novos campos de configuração de vínculo no cadastro do profissional
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS projeto TEXT,
  ADD COLUMN IF NOT EXISTS horas_previstas NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS jornada TEXT;

-- 2) Tabela de frequência de Efetivos (padrão AGILIBlue)
CREATE TABLE IF NOT EXISTS public.frequencias_efetivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competencia_id UUID NOT NULL REFERENCES public.competencias(id) ON DELETE CASCADE,
  unidade_id UUID NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,

  -- Snapshot do vínculo (somente leitura na UI, gravado no primeiro save)
  proj TEXT,
  hp NUMERIC(6,2),
  ch NUMERIC(6,2),
  jorn TEXT,

  -- Totalizadores
  dias_falta NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (dias_falta >= 0),
  att NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (att >= 0),
  mat NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (mat >= 0),

  -- Horas extras
  he_50 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (he_50 >= 0),
  he_100 NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (he_100 >= 0),

  -- Férias 1/3 (marcação)
  ferias_um_terco BOOLEAN NOT NULL DEFAULT false,

  -- Variáveis financeiras
  integ NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (integ >= 0),
  sal_sub_h NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sal_sub_h >= 0),
  adic_not NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (adic_not >= 0),
  aulas_supl NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (aulas_supl >= 0),
  plantao NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (plantao >= 0),
  sobreaviso NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (sobreaviso >= 0),
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

CREATE INDEX IF NOT EXISTS idx_freq_efetivos_comp_unid
  ON public.frequencias_efetivos (competencia_id, unidade_id);
CREATE INDEX IF NOT EXISTS idx_freq_efetivos_prof
  ON public.frequencias_efetivos (profissional_id);

-- 3) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias_efetivos TO authenticated;
GRANT ALL ON public.frequencias_efetivos TO service_role;

-- 4) RLS
ALTER TABLE public.frequencias_efetivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freq_efetivos_select" ON public.frequencias_efetivos;
CREATE POLICY "freq_efetivos_select" ON public.frequencias_efetivos
  FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_efetivos_insert" ON public.frequencias_efetivos;
CREATE POLICY "freq_efetivos_insert" ON public.frequencias_efetivos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_efetivos_update" ON public.frequencias_efetivos;
CREATE POLICY "freq_efetivos_update" ON public.frequencias_efetivos
  FOR UPDATE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  )
  WITH CHECK (
    public.is_master(auth.uid())
    OR public.user_has_unit(auth.uid(), unidade_id)
  );

DROP POLICY IF EXISTS "freq_efetivos_delete" ON public.frequencias_efetivos;
CREATE POLICY "freq_efetivos_delete" ON public.frequencias_efetivos
  FOR DELETE TO authenticated
  USING (public.is_master(auth.uid()));

-- 5) Triggers padrão
DROP TRIGGER IF EXISTS trg_freq_efetivos_updated_at ON public.frequencias_efetivos;
CREATE TRIGGER trg_freq_efetivos_updated_at
  BEFORE UPDATE ON public.frequencias_efetivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS trg_freq_efetivos_updated_by ON public.frequencias_efetivos;
CREATE TRIGGER trg_freq_efetivos_updated_by
  BEFORE INSERT OR UPDATE ON public.frequencias_efetivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- 6) Auditoria
DROP TRIGGER IF EXISTS trg_freq_efetivos_audit ON public.frequencias_efetivos;
CREATE TRIGGER trg_freq_efetivos_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.frequencias_efetivos
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
