-- 1) Trigger: auto-vincular unidades ativas da secretaria ao criar competência
CREATE OR REPLACE FUNCTION public.tg_competencias_auto_vincular_unidades()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.competencia_unidades (competencia_id, unidade_id, status, created_by)
  SELECT NEW.id, u.id, 'nao_iniciada'::public.status_competencia_unidade, NEW.created_by
  FROM public.unidades u
  WHERE u.secretaria_id = NEW.secretaria_id
    AND u.status = 'ativa'
    AND u.deleted_at IS NULL
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_competencias_auto_vincular ON public.competencias;
CREATE TRIGGER trg_competencias_auto_vincular
AFTER INSERT ON public.competencias
FOR EACH ROW EXECUTE FUNCTION public.tg_competencias_auto_vincular_unidades();

-- 2) Backfill: vincular unidades faltantes nas competências já existentes
INSERT INTO public.competencia_unidades (competencia_id, unidade_id, status, created_by)
SELECT c.id, u.id, 'nao_iniciada'::public.status_competencia_unidade, c.created_by
FROM public.competencias c
JOIN public.unidades u ON u.secretaria_id = c.secretaria_id
WHERE c.deleted_at IS NULL
  AND u.status = 'ativa'
  AND u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.competencia_unidades cu
    WHERE cu.competencia_id = c.id AND cu.unidade_id = u.id AND cu.deleted_at IS NULL
  );