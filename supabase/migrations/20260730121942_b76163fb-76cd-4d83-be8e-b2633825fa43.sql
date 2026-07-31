ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS purga_apos timestamptz;

UPDATE public.documentos
   SET purga_apos = deleted_at + CASE WHEN tipo_entidade = 'frequencia'
                                      THEN INTERVAL '5 years' ELSE INTERVAL '2 years' END
 WHERE deleted_at IS NOT NULL AND purga_apos IS NULL;

CREATE INDEX IF NOT EXISTS documentos_purga_idx
  ON public.documentos (purga_apos)
  WHERE deleted_at IS NOT NULL;