ALTER TABLE public.sistemas_externos 
ADD COLUMN IF NOT EXISTS clock_skew_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS nonce TEXT,
ADD COLUMN IF NOT EXISTS jti_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.sistemas_externos.clock_skew_segundos IS 'Tolerância de atraso de relógio em segundos';
COMMENT ON COLUMN public.sistemas_externos.nonce IS 'Valor aleatório para evitar replay attacks';
COMMENT ON COLUMN public.sistemas_externos.jti_enabled IS 'Se deve gerar JTI (JWT ID) no token';