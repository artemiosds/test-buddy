ALTER TABLE public.avisos_mural
ADD COLUMN notificar_email boolean DEFAULT false;

ALTER TABLE public.avisos_mural
ADD COLUMN email_enviado_em timestamptz;

-- Grant permissions for service_role and authenticated (ensure they are current)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos_mural TO authenticated;
GRANT ALL ON public.avisos_mural TO service_role;
