
-- ============================================================
-- ONDA 3: Assinaturas pessoais (auto-cadastro pelo próprio usuário)
-- ============================================================

-- 1) Flag para distinguir assinatura pessoal (do próprio usuário) da institucional
ALTER TABLE public.assinaturas_institucionais
  ADD COLUMN IF NOT EXISTS is_pessoal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_assin_pessoal
  ON public.assinaturas_institucionais (usuario_id, unidade_id, ativa)
  WHERE is_pessoal = true AND deleted_at IS NULL;

-- 2) Perfis que podem ter assinatura pessoal (via seed)
CREATE TABLE IF NOT EXISTS public.assinatura_perfis_elegiveis (
  perfil_codigo text PRIMARY KEY,
  descricao text
);
GRANT SELECT ON public.assinatura_perfis_elegiveis TO authenticated;
GRANT ALL ON public.assinatura_perfis_elegiveis TO service_role;
ALTER TABLE public.assinatura_perfis_elegiveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfis elegiveis leitura" ON public.assinatura_perfis_elegiveis;
CREATE POLICY "perfis elegiveis leitura" ON public.assinatura_perfis_elegiveis
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.assinatura_perfis_elegiveis (perfil_codigo, descricao) VALUES
  ('DIRETOR', 'Diretor de Unidade'),
  ('COORDENADOR', 'Coordenador de Setor'),
  ('GESTAO', 'Gestor da Secretaria'),
  ('GESTOR', 'Gestor'),
  ('MASTER', 'Master')
ON CONFLICT (perfil_codigo) DO NOTHING;

-- 3) Helper: perfil elegível?
CREATE OR REPLACE FUNCTION public.usuario_pode_cadastrar_assinatura(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    JOIN public.assinatura_perfis_elegiveis e ON e.perfil_codigo = p.codigo
    WHERE u.id = _user_id AND u.deleted_at IS NULL AND u.status = 'ativo'
  );
$$;

-- 4) RLS: usuário pode ler as próprias
DROP POLICY IF EXISTS "assinaturas_select_own" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_select_own" ON public.assinaturas_institucionais
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() AND deleted_at IS NULL);

-- 5) RLS: usuário pode inserir a própria (is_pessoal=true, usuario_id=auth.uid(), unidade em usuario_unidades)
DROP POLICY IF EXISTS "assinaturas_insert_own" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_insert_own" ON public.assinaturas_institucionais
  FOR INSERT TO authenticated
  WITH CHECK (
    is_pessoal = true
    AND usuario_id = auth.uid()
    AND public.usuario_pode_cadastrar_assinatura(auth.uid())
    AND (unidade_id IS NULL OR public.user_has_unit(auth.uid(), unidade_id))
  );

-- 6) RLS: usuário pode atualizar as próprias (pessoais)
DROP POLICY IF EXISTS "assinaturas_update_own" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_update_own" ON public.assinaturas_institucionais
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid() AND is_pessoal = true)
  WITH CHECK (usuario_id = auth.uid() AND is_pessoal = true);

-- 7) RLS: usuário pode "excluir" (soft delete via update) as próprias — cobre DELETE via cliente
DROP POLICY IF EXISTS "assinaturas_delete_own" ON public.assinaturas_institucionais;
CREATE POLICY "assinaturas_delete_own" ON public.assinaturas_institucionais
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() AND is_pessoal = true);

-- 8) Trigger: força coerência de assinatura pessoal e desativa anteriores
CREATE OR REPLACE FUNCTION public.tg_assinatura_pessoal_normalizar()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _perfil_id uuid;
BEGIN
  IF NEW.is_pessoal IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Sincroniza perfil_id com o perfil corrente do usuário
  SELECT perfil_id INTO _perfil_id
    FROM public.usuarios WHERE id = NEW.usuario_id;
  IF _perfil_id IS NOT NULL THEN
    NEW.perfil_id := _perfil_id;
  END IF;

  -- Se ativa, desativa as anteriores do mesmo escopo pessoal
  IF NEW.ativa IS TRUE AND (TG_OP = 'INSERT' OR NEW.ativa IS DISTINCT FROM OLD.ativa) THEN
    UPDATE public.assinaturas_institucionais
       SET ativa = false, updated_at = now()
     WHERE is_pessoal = true
       AND usuario_id = NEW.usuario_id
       AND COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(NEW.unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND tipo = NEW.tipo
       AND id <> COALESCE(NEW.id, gen_random_uuid())
       AND ativa = true
       AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assinatura_pessoal_normalizar ON public.assinaturas_institucionais;
CREATE TRIGGER trg_assinatura_pessoal_normalizar
BEFORE INSERT OR UPDATE ON public.assinaturas_institucionais
FOR EACH ROW EXECUTE FUNCTION public.tg_assinatura_pessoal_normalizar();

-- 9) Trigger: desativa assinaturas quando o usuário perde a unidade
CREATE OR REPLACE FUNCTION public.tg_desativar_assinaturas_perda_unidade()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    UPDATE public.assinaturas_institucionais
       SET ativa = false, updated_at = now()
     WHERE is_pessoal = true AND usuario_id = OLD.usuario_id
       AND unidade_id = OLD.unidade_id AND ativa = true;
    RETURN OLD;
  END IF;
  IF (NEW.data_fim IS NOT NULL AND NEW.data_fim < CURRENT_DATE
      AND (OLD.data_fim IS NULL OR OLD.data_fim >= CURRENT_DATE)) THEN
    UPDATE public.assinaturas_institucionais
       SET ativa = false, updated_at = now()
     WHERE is_pessoal = true AND usuario_id = NEW.usuario_id
       AND unidade_id = NEW.unidade_id AND ativa = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desativar_assin_perda_unidade ON public.usuario_unidades;
CREATE TRIGGER trg_desativar_assin_perda_unidade
AFTER UPDATE OR DELETE ON public.usuario_unidades
FOR EACH ROW EXECUTE FUNCTION public.tg_desativar_assinaturas_perda_unidade();

-- 10) Trigger: desativa quando usuário fica inativo/desligado
CREATE OR REPLACE FUNCTION public.tg_desativar_assinaturas_status_usuario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status <> 'ativo' AND OLD.status = 'ativo' THEN
    UPDATE public.assinaturas_institucionais
       SET ativa = false, updated_at = now()
     WHERE is_pessoal = true AND usuario_id = NEW.id AND ativa = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_desativar_assin_status_usuario ON public.usuarios;
CREATE TRIGGER trg_desativar_assin_status_usuario
AFTER UPDATE OF status ON public.usuarios
FOR EACH ROW EXECUTE FUNCTION public.tg_desativar_assinaturas_status_usuario();

-- 11) RPC: pendentes (usuários elegíveis sem assinatura ativa)
CREATE OR REPLACE FUNCTION public.assinatura_pendentes()
RETURNS TABLE(
  usuario_id uuid,
  nome text,
  email text,
  perfil_codigo text,
  perfil_nome text,
  unidade_id uuid,
  unidade_nome text,
  dias_pendente int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH elegiveis AS (
    SELECT u.id AS usuario_id, u.nome_completo AS nome, u.email,
           p.codigo AS perfil_codigo, p.nome AS perfil_nome,
           u.created_at
    FROM public.usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    JOIN public.assinatura_perfis_elegiveis e ON e.perfil_codigo = p.codigo
    WHERE u.deleted_at IS NULL AND u.status = 'ativo'
  ),
  unids AS (
    SELECT DISTINCT uu.usuario_id, uu.unidade_id, un.nome AS unidade_nome
    FROM public.usuario_unidades uu
    JOIN public.unidades un ON un.id = uu.unidade_id
    WHERE uu.deleted_at IS NULL
      AND (uu.data_fim IS NULL OR uu.data_fim >= CURRENT_DATE)
  )
  SELECT e.usuario_id, e.nome, e.email, e.perfil_codigo, e.perfil_nome,
         u.unidade_id, u.unidade_nome,
         GREATEST(0, EXTRACT(DAY FROM now() - e.created_at)::int) AS dias_pendente
  FROM elegiveis e
  LEFT JOIN unids u ON u.usuario_id = e.usuario_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.assinaturas_institucionais a
    WHERE a.is_pessoal = true AND a.ativa = true AND a.deleted_at IS NULL
      AND a.usuario_id = e.usuario_id
      AND COALESCE(a.unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(u.unidade_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  ORDER BY e.nome;
$$;

-- 12) RPC: dashboard admin
CREATE OR REPLACE FUNCTION public.assinatura_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _total_elegiveis int;
  _com_assinatura int;
  _pendentes int;
  _expirando int;
BEGIN
  SELECT COUNT(*) INTO _total_elegiveis
    FROM public.usuarios u
    JOIN public.perfis p ON p.id = u.perfil_id
    JOIN public.assinatura_perfis_elegiveis e ON e.perfil_codigo = p.codigo
   WHERE u.deleted_at IS NULL AND u.status = 'ativo';

  SELECT COUNT(DISTINCT usuario_id) INTO _com_assinatura
    FROM public.assinaturas_institucionais
   WHERE is_pessoal = true AND ativa = true AND deleted_at IS NULL;

  SELECT COUNT(*) INTO _expirando
    FROM public.assinaturas_institucionais
   WHERE is_pessoal = true AND ativa = true AND deleted_at IS NULL
     AND vigencia_fim IS NOT NULL
     AND vigencia_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';

  _pendentes := GREATEST(0, _total_elegiveis - _com_assinatura);

  RETURN jsonb_build_object(
    'total_elegiveis', _total_elegiveis,
    'com_assinatura', _com_assinatura,
    'pendentes', _pendentes,
    'expirando_30d', _expirando,
    'gerado_em', now()
  );
END;
$$;

-- 13) RPC: notificar pendentes (autorizado: master ou assinatura.gerenciar)
CREATE OR REPLACE FUNCTION public.notificar_assinatura_pendentes()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  _caller uuid := auth.uid();
  _n int := 0;
  r RECORD;
BEGIN
  IF _caller IS NULL OR (NOT public.is_master(_caller)
       AND NOT public.has_permission(_caller, 'assinatura.gerenciar')) THEN
    RAISE EXCEPTION 'Sem permissão para notificar pendentes' USING ERRCODE = '42501';
  END IF;

  FOR r IN SELECT * FROM public.assinatura_pendentes() LOOP
    -- Evita duplicar: só cria se não houver notificação não-lida do mesmo tipo
    IF NOT EXISTS (
      SELECT 1 FROM public.notificacoes
       WHERE usuario_id = r.usuario_id
         AND entidade_tipo = 'assinatura_pendente'
         AND lida = false
         AND created_at > now() - INTERVAL '48 hours'
    ) THEN
      INSERT INTO public.notificacoes(
        usuario_id, tipo, titulo, mensagem, prioridade, canal,
        entidade_tipo, link, created_by
      ) VALUES (
        r.usuario_id, 'alerta'::public.tipo_notificacao,
        'Cadastre sua assinatura digital',
        'Como ' || r.perfil_nome || ', você precisa cadastrar sua assinatura para que documentos oficiais possam ser assinados automaticamente. Acesse Meu Perfil → Assinatura.',
        'alta'::public.prioridade_notificacao,
        'interno'::public.canal_notificacao,
        'assinatura_pendente', '/meu-perfil/assinatura', _caller
      );
      _n := _n + 1;
    END IF;
  END LOOP;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.usuario_pode_cadastrar_assinatura(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinatura_pendentes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assinatura_dashboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificar_assinatura_pendentes() TO authenticated;
