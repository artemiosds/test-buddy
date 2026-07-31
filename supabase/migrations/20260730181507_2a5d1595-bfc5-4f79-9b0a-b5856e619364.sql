ALTER TABLE public.profissionais
  ADD COLUMN IF NOT EXISTS situacao_data_inicio date,
  ADD COLUMN IF NOT EXISTS situacao_data_fim date;

CREATE OR REPLACE FUNCTION public.tg_profissional_situacao_periodo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.situacao_data_inicio IS NOT NULL
     AND NEW.situacao_data_fim IS NOT NULL
     AND NEW.situacao_data_fim < NEW.situacao_data_inicio THEN
    RAISE EXCEPTION 'A data de fim não pode ser anterior à data de início da situação funcional';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profissional_situacao_periodo ON public.profissionais;
CREATE TRIGGER trg_profissional_situacao_periodo
BEFORE INSERT OR UPDATE ON public.profissionais
FOR EACH ROW EXECUTE FUNCTION public.tg_profissional_situacao_periodo();

CREATE INDEX IF NOT EXISTS idx_profissionais_situacao_data_fim
  ON public.profissionais (situacao_data_fim)
  WHERE situacao_data_fim IS NOT NULL;