CREATE TABLE public.sistemas_externos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    url_base TEXT NOT NULL,
    icone TEXT DEFAULT 'ExternalLink',
    cor TEXT DEFAULT '#3b82f6',
    ordem INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Ativo',
    tipo_autenticacao TEXT DEFAULT 'JWT SSO',
    endpoint_sso TEXT,
    endpoint_logout TEXT,
    endpoint_refresh TEXT,
    audience TEXT,
    issuer TEXT,
    token_exp_segundos INTEGER DEFAULT 60,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistemas_externos TO authenticated;
GRANT ALL ON public.sistemas_externos TO service_role;

ALTER TABLE public.sistemas_externos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters e Gestores podem gerenciar sistemas externos"
ON public.sistemas_externos
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin') OR 
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'moderator'
    )
);

CREATE POLICY "Todos autenticados podem ver sistemas ativos"
ON public.sistemas_externos
FOR SELECT
TO authenticated
USING (ativo = true);

INSERT INTO public.sistemas_externos (
    nome, 
    descricao, 
    url_base, 
    icone, 
    cor, 
    tipo_autenticacao, 
    endpoint_sso, 
    status
) VALUES (
    'Plantão Inteligente',
    'Gestão de Plantões e Escalas',
    'https://plantao-inteligente.vercel.app',
    'CalendarClock',
    '#8b5cf6',
    'JWT SSO',
    '/auth/sso',
    'Ativo'
);
