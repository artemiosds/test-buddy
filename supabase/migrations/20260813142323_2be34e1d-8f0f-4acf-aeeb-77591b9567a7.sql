-- Restaura valores padrão ("0") nas colunas de frequência que foram migradas para TEXT
ALTER TABLE public.frequencias_contratados
  ALTER COLUMN dias_falta SET DEFAULT '0',
  ALTER COLUMN atestado SET DEFAULT '0',
  ALTER COLUMN he_50 SET DEFAULT '0',
  ALTER COLUMN he_100 SET DEFAULT '0',
  ALTER COLUMN adn SET DEFAULT '0',
  ALTER COLUMN plantoes SET DEFAULT '0',
  ALTER COLUMN sobreaviso SET DEFAULT '0',
  ALTER COLUMN incentivo SET DEFAULT '0',
  ALTER COLUMN observacoes SET DEFAULT NULL;

ALTER TABLE public.frequencia_profissional
  ALTER COLUMN dias_trabalhados SET DEFAULT '0',
  ALTER COLUMN faltas_justificadas SET DEFAULT '0',
  ALTER COLUMN faltas_injustificadas SET DEFAULT '0',
  ALTER COLUMN ferias SET DEFAULT '0',
  ALTER COLUMN licencas SET DEFAULT '0',
  ALTER COLUMN afastamentos SET DEFAULT '0',
  ALTER COLUMN horas_extras SET DEFAULT '0',
  ALTER COLUMN adicional_noturno SET DEFAULT '0',
  ALTER COLUMN plantoes_extras SET DEFAULT '0',
  ALTER COLUMN atestado SET DEFAULT '0',
  ALTER COLUMN he_50 SET DEFAULT '0',
  ALTER COLUMN he_100 SET DEFAULT '0',
  ALTER COLUMN sobreaviso SET DEFAULT '0',
  ALTER COLUMN incentivo SET DEFAULT '0',
  ALTER COLUMN licenca_premio SET DEFAULT '0',
  ALTER COLUMN ferias_terco SET DEFAULT '0',
  ALTER COLUMN ferias_integral SET DEFAULT '0',
  ALTER COLUMN sal_sub_h SET DEFAULT '0';

-- Corrige linhas antigas que ficaram com a string literal 'NULL'
UPDATE public.frequencia_profissional
SET atestado = CASE WHEN atestado = 'NULL' THEN '0' ELSE atestado END,
    he_50 = CASE WHEN he_50 = 'NULL' THEN '0' ELSE he_50 END,
    he_100 = CASE WHEN he_100 = 'NULL' THEN '0' ELSE he_100 END,
    sobreaviso = CASE WHEN sobreaviso = 'NULL' THEN '0' ELSE sobreaviso END,
    incentivo = CASE WHEN incentivo = 'NULL' THEN '0' ELSE incentivo END,
    licenca_premio = CASE WHEN licenca_premio = 'NULL' THEN '0' ELSE licenca_premio END
WHERE 'NULL' IN (atestado, he_50, he_100, sobreaviso, incentivo, licenca_premio);