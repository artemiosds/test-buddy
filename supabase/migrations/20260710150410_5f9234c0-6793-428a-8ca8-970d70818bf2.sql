
-- =====================================================================
-- REFINAMENTO 01c — GATILHOS DA FUNDAÇÃO ORGANIZACIONAL
-- =====================================================================

-- Função para preencher automaticamente updated_by com auth.uid()
CREATE OR REPLACE FUNCTION public.tg_set_updated_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.updated_by = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    -- Se auth.uid() não estiver disponível (ex: seed/admin), mantém o valor enviado
    NULL;
  END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_set_updated_by() FROM PUBLIC;

-- Aplicar gatilhos em cada tabela
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'secretarias','municipio_config','unidades','setores',
    'fundos','cargos','funcoes','vinculos','calendario_institucional'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_set_updated_at ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_set_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at()', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_set_updated_by ON public.%1$s', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_set_updated_by BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by()', t);
  END LOOP;
END $$;
