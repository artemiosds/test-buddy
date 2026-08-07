ALTER TABLE public.avisos_mural ADD COLUMN IF NOT EXISTS subtitulo text;

CREATE TABLE IF NOT EXISTS public.avisos_mural_anexos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aviso_id uuid NOT NULL REFERENCES public.avisos_mural(id) ON DELETE CASCADE,
    nome text NOT NULL,
    path text NOT NULL,
    mime text NOT NULL,
    size bigint NOT NULL,
    bucket text NOT NULL DEFAULT 'mural_anexos',
    criado_em timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.avisos_mural_anexos TO authenticated;
GRANT ALL ON public.avisos_mural_anexos TO service_role;

ALTER TABLE public.avisos_mural_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer usuário autenticado pode ver anexos"
    ON public.avisos_mural_anexos FOR SELECT
    TO authenticated
    USING (true);
