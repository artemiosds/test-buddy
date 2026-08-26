CREATE TABLE public.configuracoes_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE DEFAULT 'smtp_principal',
  smtp_host text,
  smtp_port integer NOT NULL DEFAULT 587,
  smtp_user text,
  smtp_password text,
  smtp_from_email text,
  smtp_from_name text NOT NULL DEFAULT 'Sistema de Frequência',
  smtp_secure boolean NOT NULL DEFAULT false,
  smtp_ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.usuarios(id)
);

GRANT ALL ON public.configuracoes_sistema TO service_role;

ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Somente o servidor acessa as configuracoes de sistema"
ON public.configuracoes_sistema
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_configuracoes_sistema_updated_at
BEFORE UPDATE ON public.configuracoes_sistema
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();