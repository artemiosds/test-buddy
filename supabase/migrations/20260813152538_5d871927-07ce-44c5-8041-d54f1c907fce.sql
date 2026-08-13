
-- 1. BACKUP
CREATE TABLE IF NOT EXISTS public.frequencia_profissional_backup_20260813 AS SELECT * FROM public.frequencia_profissional;
CREATE TABLE IF NOT EXISTS public.frequencias_contratados_backup_20260813 AS SELECT * FROM public.frequencias_contratados;

GRANT SELECT ON public.frequencia_profissional_backup_20260813 TO authenticated;
GRANT SELECT ON public.frequencias_contratados_backup_20260813 TO authenticated;

-- 2. FUNÇÃO DE LIMPEZA
CREATE OR REPLACE FUNCTION public.limpar_valor_texto(val TEXT) 
RETURNS TEXT AS $$
BEGIN
  IF val IS NULL OR val = '' THEN
    RETURN val;
  END IF;

  -- Se for apenas dígitos e um separador seguido de zeros (Ex: "32.00", "32,00")
  IF val ~ '^-?\d+([.,]0+)$' THEN
    RETURN regexp_replace(val, '[.,]0+$', '');
  END IF;

  -- Se for numérico com decimais reais, remove zeros à direita (Ex: "1,50" -> "1,5")
  IF val ~ '^-?\d+[.,]\d+$' THEN
    RETURN regexp_replace(regexp_replace(val, '0+$', ''), '[.,]$', '');
  END IF;

  RETURN val;
END;
$$ LANGUAGE plpgsql;

-- 3. CONTAGEM ANTES (Para log)
SELECT 'EFETIVOS ANTES' as label, count(*) FROM public.frequencia_profissional 
WHERE dias_trabalhados ~ '[.,]0+$' OR atestado ~ '[.,]0+$' OR he_50 ~ '[.,]0+$';

-- 4. EXECUÇÃO
UPDATE public.frequencia_profissional
SET 
  dias_trabalhados = limpar_valor_texto(dias_trabalhados),
  atestado = limpar_valor_texto(atestado),
  he_50 = limpar_valor_texto(he_50),
  he_100 = limpar_valor_texto(he_100),
  ferias_terco = limpar_valor_texto(ferias_terco),
  ferias_integral = limpar_valor_texto(ferias_integral),
  adicional_noturno = limpar_valor_texto(adicional_noturno),
  sobreaviso = limpar_valor_texto(sobreaviso),
  plantoes_extras = limpar_valor_texto(plantoes_extras),
  incentivo = limpar_valor_texto(incentivo),
  ferias = limpar_valor_texto(ferias),
  licenca_premio = limpar_valor_texto(licenca_premio);

UPDATE public.frequencias_contratados
SET 
  dias_trabalhados = limpar_valor_texto(dias_trabalhados),
  dias_falta = limpar_valor_texto(dias_falta),
  atestado = limpar_valor_texto(atestado),
  he_50 = limpar_valor_texto(he_50),
  he_100 = limpar_valor_texto(he_100),
  adn = limpar_valor_texto(adn),
  plantoes = limpar_valor_texto(plantoes),
  sobreaviso = limpar_valor_texto(sobreaviso),
  incentivo = limpar_valor_texto(incentivo);

-- 5. CONTAGEM DEPOIS
SELECT 'EFETIVOS DEPOIS' as label, count(*) FROM public.frequencia_profissional 
WHERE dias_trabalhados ~ '[.,]0+$' OR atestado ~ '[.,]0+$' OR he_50 ~ '[.,]0+$';
