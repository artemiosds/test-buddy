
-- =====================================================================
-- MIGRATION 02.02 — PERFIS
-- =====================================================================

CREATE TABLE public.perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  nivel_hierarquico INTEGER NOT NULL DEFAULT 100 CHECK (nivel_hierarquico >= 0),
  is_sistema BOOLEAN NOT NULL DEFAULT false,
  status public.status_entidade NOT NULL DEFAULT 'ativa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX ux_perfis_codigo_ativo ON public.perfis(codigo) WHERE deleted_at IS NULL;
CREATE INDEX ix_perfis_nivel ON public.perfis(nivel_hierarquico) WHERE deleted_at IS NULL;
CREATE INDEX ix_perfis_status ON public.perfis(status) WHERE deleted_at IS NULL;

-- Vínculo do usuário com perfil (nulável — pode existir usuário sem perfil, controlado só por permissões individuais)
ALTER TABLE public.usuarios
  ADD COLUMN perfil_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL;
CREATE INDEX ix_usuarios_perfil ON public.usuarios(perfil_id) WHERE deleted_at IS NULL AND perfil_id IS NOT NULL;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT ALL ON public.perfis TO service_role;

-- RLS
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_perfis" ON public.perfis FOR SELECT TO authenticated USING (true);

-- Triggers
CREATE TRIGGER trg_perfis_set_updated_at BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_perfis_set_updated_by BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
