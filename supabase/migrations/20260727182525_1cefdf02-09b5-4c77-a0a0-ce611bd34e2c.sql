CREATE TABLE public.piso_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia text NOT NULL,
  categoria text NOT NULL,
  valor_referencia numeric(12,2) NOT NULL CHECK (valor_referencia >= 0),
  jornada_base integer NOT NULL DEFAULT 44 CHECK (jornada_base > 0),
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT piso_referencia_competencia_fmt CHECK (competencia ~ '^[0-9]{4}-[0-9]{2}$'),
  CONSTRAINT piso_referencia_categoria_chk CHECK (categoria IN ('ENFERMEIRO','TECNICO_ENFERMAGEM','AUXILIAR_ENFERMAGEM')),
  CONSTRAINT piso_referencia_unica UNIQUE (competencia, categoria)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.piso_referencia TO authenticated;
GRANT ALL ON public.piso_referencia TO service_role;

ALTER TABLE public.piso_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "piso_referencia_select" ON public.piso_referencia
FOR SELECT TO authenticated
USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.visualizar'));

CREATE POLICY "piso_referencia_write" ON public.piso_referencia
FOR ALL TO authenticated
USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'))
WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'piso.importar'));

CREATE TRIGGER piso_referencia_set_updated_at
BEFORE UPDATE ON public.piso_referencia
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.piso_referencia (competencia, categoria, valor_referencia, observacao)
VALUES
  (to_char(now(), 'YYYY-MM'), 'ENFERMEIRO', 4750.00, 'Valor inicial migrado do código'),
  (to_char(now(), 'YYYY-MM'), 'TECNICO_ENFERMAGEM', 3325.00, 'Valor inicial migrado do código'),
  (to_char(now(), 'YYYY-MM'), 'AUXILIAR_ENFERMAGEM', 2375.00, 'Valor inicial migrado do código')
ON CONFLICT DO NOTHING;