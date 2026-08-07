-- 1. Tabela de Auditoria Detalhada (Histórico de Estados)
CREATE TABLE IF NOT EXISTS public.frequencia_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frequencia_id UUID NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
    status_anterior public.status_frequencia,
    status_novo public.status_frequencia NOT NULL,
    acao TEXT NOT NULL,
    justificativa TEXT,
    executado_por UUID REFERENCES auth.users(id),
    executado_nome TEXT,
    executado_perfil TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.frequencia_historico TO authenticated;
GRANT ALL ON public.frequencia_historico TO service_role;

ALTER TABLE public.frequencia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frequencia_historico_select" ON public.frequencia_historico
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))
        )
    );

-- 2. Garantir colunas de rastreamento na frequencias_contratados
ALTER TABLE public.frequencias_contratados ADD COLUMN IF NOT EXISTS devolvida_por UUID REFERENCES auth.users(id);
ALTER TABLE public.frequencias_contratados ADD COLUMN IF NOT EXISTS devolvida_em TIMESTAMPTZ;
ALTER TABLE public.frequencias_contratados ADD COLUMN IF NOT EXISTS justificativa_devolucao TEXT;

-- 3. Tabela de Pendências por Linha
CREATE TABLE IF NOT EXISTS public.frequencia_pendencias_linhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    frequencia_id UUID NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
    profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
    rubrica TEXT,
    motivo_pendencia TEXT NOT NULL,
    aberto_por UUID REFERENCES auth.users(id),
    aberto_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolvido_em TIMESTAMPTZ,
    resolvido_por UUID REFERENCES auth.users(id),
    status public.status_pendencia NOT NULL DEFAULT 'aberta'
);

GRANT SELECT, INSERT, UPDATE ON public.frequencia_pendencias_linhas TO authenticated;
GRANT ALL ON public.frequencia_pendencias_linhas TO service_role;

ALTER TABLE public.frequencia_pendencias_linhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frequencia_pendencias_linhas_select" ON public.frequencia_pendencias_linhas
    FOR SELECT TO authenticated
    USING (
        public.is_master(auth.uid()) 
        OR EXISTS (
            SELECT 1 FROM public.frequencias f
            JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
            WHERE f.id = frequencia_id AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), cu.unidade_id))
        )
    );

-- 4. Função Anti-Duplicata
CREATE OR REPLACE FUNCTION public.check_frequencia_duplicada(_profissional_id UUID, _competencia_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.frequencias_contratados 
        WHERE profissional_id = _profissional_id 
          AND competencia_id = _competencia_id 
          AND status = 'aprovada'
          AND deleted_at IS NULL
    );
END;
$$;
