CREATE TABLE IF NOT EXISTS public.avisos_mural (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo text NOT NULL,
    mensagem text NOT NULL,
    tipo text NOT NULL DEFAULT 'informativo',
    prioridade text NOT NULL DEFAULT 'normal',
    fixado boolean NOT NULL DEFAULT false,
    destinatarios jsonb NOT NULL DEFAULT '{"tipo":"todos"}'::jsonb,
    confirmacao_obrigatoria boolean NOT NULL DEFAULT false,
    data_inicio date NOT NULL DEFAULT CURRENT_DATE,
    data_fim date,
    ativo boolean NOT NULL DEFAULT true,
    criado_por uuid REFERENCES auth.users(id),
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.avisos_mural_leituras (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    aviso_id uuid NOT NULL REFERENCES public.avisos_mural(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES auth.users(id),
    lido_em timestamptz NOT NULL DEFAULT now(),
    confirmado boolean NOT NULL DEFAULT false,
    UNIQUE(aviso_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.avisos_mural TO authenticated;
GRANT ALL ON public.avisos_mural TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.avisos_mural_leituras TO authenticated;
GRANT ALL ON public.avisos_mural_leituras TO service_role;

CREATE OR REPLACE FUNCTION public.is_aviso_gestor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    WHERE u.id = _user_id AND p.codigo IN ('MASTER', 'GESTOR')
  )
$$;

ALTER TABLE public.avisos_mural ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem avisos vigentes"
ON public.avisos_mural
FOR SELECT
TO authenticated
USING (
    ativo = true AND data_inicio <= CURRENT_DATE AND (data_fim IS NULL OR data_fim >= CURRENT_DATE)
);

CREATE POLICY "Gestores gerenciam avisos"
ON public.avisos_mural
FOR ALL
TO authenticated
USING (public.is_aviso_gestor(auth.uid()))
WITH CHECK (public.is_aviso_gestor(auth.uid()));

ALTER TABLE public.avisos_mural_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios gerenciam suas leituras"
ON public.avisos_mural_leituras
FOR ALL
TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());