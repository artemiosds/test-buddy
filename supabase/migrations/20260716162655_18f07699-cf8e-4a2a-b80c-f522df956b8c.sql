-- 1) Novo enum situacao_funcional (não substitui status_profissional)
DO $$ BEGIN
  CREATE TYPE public.situacao_funcional AS ENUM (
    'ativo','licenca','ferias','cedido','afastado','desligado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Campos aditivos em profissionais (todos opcionais)
ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS conselho_validade date,
  ADD COLUMN IF NOT EXISTS gestor_imediato_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS situacao_funcional public.situacao_funcional;

-- 3) Índice para lookup por gestor (relatórios "meus liderados")
CREATE INDEX IF NOT EXISTS idx_profissionais_gestor_imediato
  ON public.profissionais(gestor_imediato_id)
  WHERE gestor_imediato_id IS NOT NULL AND deleted_at IS NULL;

-- 4) Guarda contra auto-referência (profissional não pode ser gestor de si mesmo)
CREATE OR REPLACE FUNCTION public.tg_profissional_gestor_nao_self()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.gestor_imediato_id IS NOT NULL AND NEW.gestor_imediato_id = NEW.id THEN
    RAISE EXCEPTION 'Um profissional não pode ser gestor imediato de si mesmo.'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profissional_gestor_nao_self ON public.profissionais;
CREATE TRIGGER trg_profissional_gestor_nao_self
  BEFORE INSERT OR UPDATE OF gestor_imediato_id ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.tg_profissional_gestor_nao_self();