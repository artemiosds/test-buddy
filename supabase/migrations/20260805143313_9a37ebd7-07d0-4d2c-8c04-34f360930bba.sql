-- Migration para adequação da tabela sistemas_externos
DO $$ 
BEGIN 
    -- Adicionar colunas se não existirem
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'issuer') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN issuer text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'audience') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN audience text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'endpoint_sso') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN endpoint_sso text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'expiracao') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN expiracao integer DEFAULT 300;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'clock_skew') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN clock_skew integer DEFAULT 60;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'public_key') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN public_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'private_key') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN private_key text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sistemas_externos' AND column_name = 'ativo') THEN
        ALTER TABLE public.sistemas_externos ADD COLUMN ativo boolean DEFAULT true;
    END IF;
END $$;

-- Tentar garantir que o nome seja único para o ON CONFLICT funcionar
-- (Caso já existam múltiplos 'Plantão Inteligente', este comando pode falhar, mas é a forma correta de gerenciar sementes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'sistemas_externos_nome_key'
    ) THEN
        ALTER TABLE public.sistemas_externos ADD CONSTRAINT sistemas_externos_nome_key UNIQUE (nome);
    END IF;
END $$;

-- Garantir registro do Plantão Inteligente
INSERT INTO public.sistemas_externos (
    nome, 
    issuer, 
    audience, 
    endpoint_sso, 
    expiracao, 
    clock_skew, 
    ativo,
    url_base,
    icone,
    cor
)
VALUES (
    'Plantão Inteligente',
    'https://gestao-saude-sms-oriximina.vercel.app',
    'plantao-inteligente',
    'https://plantao-inteligente.vercel.app/auth/sso',
    300,
    60,
    true,
    'https://plantao-inteligente.vercel.app',
    'CalendarClock',
    '#3b82f6'
)
ON CONFLICT (nome) DO UPDATE SET
    issuer = EXCLUDED.issuer,
    audience = EXCLUDED.audience,
    endpoint_sso = EXCLUDED.endpoint_sso,
    expiracao = EXCLUDED.expiracao,
    clock_skew = EXCLUDED.clock_skew,
    ativo = EXCLUDED.ativo;
