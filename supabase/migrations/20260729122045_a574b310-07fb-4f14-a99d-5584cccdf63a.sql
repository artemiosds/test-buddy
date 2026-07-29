CREATE TABLE public.hsm_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  titulo text NOT NULL DEFAULT 'Nova conversa',
  favorito boolean NOT NULL DEFAULT false,
  arquivada boolean NOT NULL DEFAULT false,
  modelo text,
  tokens integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hsm_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES public.hsm_conversas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  papel text NOT NULL CHECK (papel IN ('user','assistant','system')),
  conteudo text NOT NULL DEFAULT '',
  partes jsonb NOT NULL DEFAULT '[]'::jsonb,
  modelo text,
  provedor text,
  tokens integer NOT NULL DEFAULT 0,
  duracao_ms integer,
  ferramentas jsonb NOT NULL DEFAULT '[]'::jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.hsm_auditoria (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  conversa_id uuid,
  modelo text,
  provedor text,
  ferramenta text,
  acao text,
  duracao_ms integer,
  tokens integer NOT NULL DEFAULT 0,
  sucesso boolean NOT NULL DEFAULT true,
  erro text,
  contexto jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hsm_conversas_user ON public.hsm_conversas(user_id, updated_at DESC);
CREATE INDEX idx_hsm_mensagens_conversa ON public.hsm_mensagens(conversa_id, created_at);
CREATE INDEX idx_hsm_auditoria_user ON public.hsm_auditoria(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hsm_conversas TO authenticated;
GRANT ALL ON public.hsm_conversas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hsm_mensagens TO authenticated;
GRANT ALL ON public.hsm_mensagens TO service_role;
GRANT SELECT, INSERT ON public.hsm_auditoria TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.hsm_auditoria_id_seq TO authenticated;
GRANT ALL ON public.hsm_auditoria TO service_role;
GRANT ALL ON SEQUENCE public.hsm_auditoria_id_seq TO service_role;

ALTER TABLE public.hsm_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsm_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsm_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY hsm_conversas_owner ON public.hsm_conversas
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY hsm_mensagens_owner ON public.hsm_mensagens
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.hsm_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.hsm_conversas c WHERE c.id = conversa_id AND c.user_id = auth.uid())
  );

CREATE POLICY hsm_auditoria_insert_own ON public.hsm_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY hsm_auditoria_select ON public.hsm_auditoria
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_permission(auth.uid(), 'auditoria.visualizar', NULL, NULL));

CREATE TRIGGER hsm_conversas_updated_at
  BEFORE UPDATE ON public.hsm_conversas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();