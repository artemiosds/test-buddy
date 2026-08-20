CREATE TABLE IF NOT EXISTS public.logs_notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destinatario TEXT NOT NULL,
    assunto TEXT NOT NULL,
    status TEXT NOT NULL, -- 'enviado' ou 'erro'
    detalhe_erro TEXT,
    data_envio TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.logs_notificacoes TO authenticated;
GRANT ALL ON public.logs_notificacoes TO service_role;

ALTER TABLE public.logs_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Masters can select logs" ON public.logs_notificacoes;
CREATE POLICY "Masters can select logs" ON public.logs_notificacoes
FOR SELECT TO authenticated
USING (public.is_master(auth.uid()));

DROP POLICY IF EXISTS "Permitir insercao de logs" ON public.logs_notificacoes;
CREATE POLICY "Permitir insercao de logs" ON public.logs_notificacoes
FOR INSERT TO authenticated, anon, service_role
WITH CHECK (true);