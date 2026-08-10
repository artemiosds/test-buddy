
-- Normalizar dados existentes
UPDATE public.cargos SET area_profissional = 'Saúde' WHERE area_profissional ILIKE 'Sa%de';
UPDATE public.cargos SET area_profissional = 'Administrativa' WHERE area_profissional ILIKE 'Administra%';
UPDATE public.cargos SET area_profissional = 'Outros' WHERE area_profissional NOT IN ('Saúde', 'Administrativa', 'Logística', 'Operacional', 'Educação') AND area_profissional IS NOT NULL;

-- Tentar aplicar a constraint novamente
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cargos_area_profissional_check') THEN
        ALTER TABLE public.cargos DROP CONSTRAINT cargos_area_profissional_check;
    END IF;
END $$;

ALTER TABLE public.cargos ADD CONSTRAINT cargos_area_profissional_check CHECK (area_profissional IN ('Saúde', 'Administrativa', 'Logística', 'Operacional', 'Educação', 'Outros'));
