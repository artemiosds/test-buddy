CREATE TABLE IF NOT EXISTS public.piso_extracao_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  motor text NOT NULL DEFAULT 'automatico' CHECK (motor IN ('automatico','texto','ocr_local','ia_visao')),
  ia_fornecedor text NOT NULL DEFAULT 'gemini' CHECK (ia_fornecedor IN ('gemini','lovable')),
  ia_modelo text NOT NULL DEFAULT 'gemini-3.6-flash',
  ia_api_key text,
  ia_habilitada boolean NOT NULL DEFAULT false,
  ocr_idioma text NOT NULL DEFAULT 'por',
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.piso_extracao_config TO service_role;

ALTER TABLE public.piso_extracao_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.piso_extracao_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.piso_extracao_config_touch() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_piso_extracao_config_touch ON public.piso_extracao_config;
CREATE TRIGGER trg_piso_extracao_config_touch BEFORE UPDATE ON public.piso_extracao_config
FOR EACH ROW EXECUTE FUNCTION public.piso_extracao_config_touch();