
-- =====================================================================
-- MIGRATION 02.01 — USUÁRIOS
-- =====================================================================

-- Enum de status do usuário
DO $$ BEGIN
  CREATE TYPE public.status_usuario AS ENUM ('ativo','inativo','bloqueado','suspenso','pendente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de usuários (complementa auth.users)
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  secretaria_id UUID REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  profissional_id UUID, -- FK adicionada na Migration futura (evita dependência circular)
  nome_completo TEXT NOT NULL,
  email CITEXT NOT NULL,
  telefone VARCHAR(20),
  cargo_descricao TEXT,
  foto_url TEXT,
  status public.status_usuario NOT NULL DEFAULT 'pendente',
  acesso_todas_unidades BOOLEAN NOT NULL DEFAULT false,
  acesso_todas_secretarias BOOLEAN NOT NULL DEFAULT false,
  ultimo_acesso_at TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Índices
CREATE UNIQUE INDEX ux_usuarios_email_ativo ON public.usuarios(email) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_secretaria ON public.usuarios(secretaria_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_profissional ON public.usuarios(profissional_id) WHERE deleted_at IS NULL AND profissional_id IS NOT NULL;
CREATE INDEX ix_usuarios_status ON public.usuarios(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_nome_trgm ON public.usuarios USING gin (nome_completo extensions.gin_trgm_ops);
CREATE INDEX ix_usuarios_ultimo_acesso ON public.usuarios(ultimo_acesso_at DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX ix_usuarios_deleted_at ON public.usuarios(deleted_at);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;

-- RLS
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política temporária (substituída na 02.06)
CREATE POLICY "usuario_ve_proprio" ON public.usuarios FOR SELECT TO authenticated USING (id = auth.uid());

-- Triggers de updated_at e updated_by
CREATE TRIGGER trg_usuarios_set_updated_at BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_usuarios_set_updated_by BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

-- ---------------------------------------------------------------------
-- Trigger de auto-criação: quando auth.users recebe INSERT, cria usuarios
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _nome TEXT;
  _telefone TEXT;
  _is_first BOOLEAN;
BEGIN
  -- Extrai nome do metadata; fallback para prefixo do e-mail
  _nome := COALESCE(
    NEW.raw_user_meta_data->>'nome_completo',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );
  _telefone := NEW.raw_user_meta_data->>'telefone';

  -- Primeiro usuário do sistema recebe acesso irrestrito (MASTER)
  SELECT NOT EXISTS (SELECT 1 FROM public.usuarios) INTO _is_first;

  INSERT INTO public.usuarios (
    id, nome_completo, email, telefone, status,
    acesso_todas_unidades, acesso_todas_secretarias
  ) VALUES (
    NEW.id,
    _nome,
    NEW.email,
    _telefone,
    CASE WHEN _is_first THEN 'ativo'::public.status_usuario ELSE 'pendente'::public.status_usuario END,
    _is_first,
    _is_first
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
