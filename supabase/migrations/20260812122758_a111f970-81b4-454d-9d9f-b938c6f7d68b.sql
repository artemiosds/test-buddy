-- FASE 1: Criar tabela de snapshot de assinaturas para workflow de frequência
CREATE TABLE public.frequencia_assinaturas_snapshot (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    frequencia_id uuid NOT NULL REFERENCES public.frequencias(id) ON DELETE CASCADE,
    acao text NOT NULL CHECK (acao IN ('enviar', 'aprovar')),
    usuario_id uuid NOT NULL,
    assinatura_id uuid REFERENCES public.assinaturas_institucionais(id) ON DELETE SET NULL,
    storage_path text,
    titular_nome text NOT NULL,
    titular_cargo text,
    posicao_x integer,
    posicao_y integer,
    tamanho_percentual integer,
    alinhamento text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (frequencia_id, acao)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencia_assinaturas_snapshot TO authenticated;
GRANT ALL ON public.frequencia_assinaturas_snapshot TO service_role;

-- RLS
ALTER TABLE public.frequencia_assinaturas_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view snapshots of their frequencies"
    ON public.frequencia_assinaturas_snapshot
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can insert snapshots when performing workflow actions"
    ON public.frequencia_assinaturas_snapshot
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = usuario_id);
