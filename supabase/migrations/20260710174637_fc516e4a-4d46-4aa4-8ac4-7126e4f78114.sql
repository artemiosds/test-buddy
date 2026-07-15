CREATE TYPE public.tipo_entidade_documento AS ENUM ('frequencia','competencia','competencia_unidade','profissional','unidade','secretaria','outros');
CREATE TYPE public.tipo_notificacao AS ENUM ('info','sucesso','alerta','erro','pendencia','aprovacao','sistema');
CREATE TYPE public.prioridade_notificacao AS ENUM ('baixa','normal','alta','urgente');
CREATE TYPE public.canal_notificacao AS ENUM ('interno','email','sms','push');
CREATE TYPE public.tipo_assinatura AS ENUM ('assinatura','carimbo','logo');
CREATE TYPE public.operacao_auditoria AS ENUM ('insert','update','delete','login','logout','custom');

-- =================== DOCUMENTOS ===================
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.documento_categorias(id),
  tipo_entidade public.tipo_entidade_documento NOT NULL,
  entidade_id UUID NOT NULL,
  unidade_id UUID REFERENCES public.unidades(id),
  secretaria_id UUID REFERENCES public.secretarias(id),
  nome TEXT NOT NULL,
  descricao TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  hash_sha256 TEXT,
  versao INT NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos TO authenticated;
GRANT ALL ON public.documentos TO service_role;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_documentos_entidade ON public.documentos(tipo_entidade, entidade_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documentos_unidade ON public.documentos(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documentos_secretaria ON public.documentos(secretaria_id) WHERE deleted_at IS NULL;
CREATE TRIGGER tg_documentos_updated_at BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_documentos_updated_by BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "documentos_select" ON public.documentos FOR SELECT TO authenticated USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR (unidade_id IS NOT NULL AND public.user_has_unit(auth.uid(), unidade_id)) OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))));
CREATE POLICY "documentos_insert" ON public.documentos FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id));
CREATE POLICY "documentos_update" ON public.documentos FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id)) WITH CHECK (public.has_permission(auth.uid(), 'documento.upload', unidade_id, secretaria_id));
CREATE POLICY "documentos_delete" ON public.documentos FOR DELETE TO authenticated USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'documento.excluir', unidade_id, secretaria_id));

-- =================== NOTIFICAÇÕES ===================
CREATE TABLE public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo public.tipo_notificacao NOT NULL DEFAULT 'info',
  prioridade public.prioridade_notificacao NOT NULL DEFAULT 'normal',
  canal public.canal_notificacao NOT NULL DEFAULT 'interno',
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  link TEXT,
  entidade_tipo TEXT,
  entidade_id UUID,
  lida BOOLEAN NOT NULL DEFAULT false,
  lida_em TIMESTAMPTZ,
  enviada BOOLEAN NOT NULL DEFAULT false,
  enviada_em TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notificacoes_usuario ON public.notificacoes(usuario_id, lida);
CREATE INDEX idx_notificacoes_created ON public.notificacoes(created_at DESC);
CREATE TRIGGER tg_notificacoes_updated_at BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "notificacoes_select_own" ON public.notificacoes FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "notificacoes_insert" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'notificacao.enviar', NULL, NULL) OR public.is_master(auth.uid()));
CREATE POLICY "notificacoes_update_own" ON public.notificacoes FOR UPDATE TO authenticated USING (usuario_id = auth.uid() OR public.is_master(auth.uid())) WITH CHECK (usuario_id = auth.uid() OR public.is_master(auth.uid()));
CREATE POLICY "notificacoes_delete" ON public.notificacoes FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

-- =================== ASSINATURAS INSTITUCIONAIS ===================
CREATE TABLE public.assinaturas_institucionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  secretaria_id UUID REFERENCES public.secretarias(id),
  unidade_id UUID REFERENCES public.unidades(id),
  usuario_id UUID REFERENCES public.usuarios(id),
  tipo public.tipo_assinatura NOT NULL DEFAULT 'assinatura',
  titular_nome TEXT NOT NULL,
  titular_cargo TEXT,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  ativa BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assinaturas_institucionais TO authenticated;
GRANT ALL ON public.assinaturas_institucionais TO service_role;
ALTER TABLE public.assinaturas_institucionais ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assinaturas_secretaria ON public.assinaturas_institucionais(secretaria_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_assinaturas_unidade ON public.assinaturas_institucionais(unidade_id) WHERE deleted_at IS NULL;
CREATE TRIGGER tg_assinaturas_updated_at BEFORE UPDATE ON public.assinaturas_institucionais FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_assinaturas_updated_by BEFORE UPDATE ON public.assinaturas_institucionais FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();
CREATE POLICY "assinaturas_select" ON public.assinaturas_institucionais FOR SELECT TO authenticated USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR (unidade_id IS NOT NULL AND public.user_has_unit(auth.uid(), unidade_id)) OR (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))));
CREATE POLICY "assinaturas_insert" ON public.assinaturas_institucionais FOR INSERT TO authenticated WITH CHECK (public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id));
CREATE POLICY "assinaturas_update" ON public.assinaturas_institucionais FOR UPDATE TO authenticated USING (public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id)) WITH CHECK (public.has_permission(auth.uid(), 'assinatura.gerenciar', unidade_id, secretaria_id));
CREATE POLICY "assinaturas_delete" ON public.assinaturas_institucionais FOR DELETE TO authenticated USING (public.is_master(auth.uid()));

-- =================== AUDITORIA ===================
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id),
  usuario_email TEXT,
  operacao public.operacao_auditoria NOT NULL,
  tabela TEXT NOT NULL,
  registro_id TEXT,
  valor_anterior JSONB,
  valor_novo JSONB,
  ip TEXT,
  user_agent TEXT,
  contexto JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.audit_log_id_seq TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT ALL ON SEQUENCE public.audit_log_id_seq TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_log_tabela ON public.audit_log(tabela, ocorrido_em DESC);
CREATE INDEX idx_audit_log_usuario ON public.audit_log(usuario_id, ocorrido_em DESC);
CREATE INDEX idx_audit_log_registro ON public.audit_log(tabela, registro_id);
CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'auditoria.visualizar', NULL, NULL));
CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- Função genérica de auditoria (usada por gatilhos futuros)
CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _op public.operacao_auditoria;
  _old JSONB; _new JSONB; _rid TEXT;
BEGIN
  IF TG_OP='INSERT' THEN _op:='insert'; _old:=NULL; _new:=to_jsonb(NEW); _rid:=(NEW).id::TEXT;
  ELSIF TG_OP='UPDATE' THEN _op:='update'; _old:=to_jsonb(OLD); _new:=to_jsonb(NEW); _rid:=(NEW).id::TEXT;
  ELSE _op:='delete'; _old:=to_jsonb(OLD); _new:=NULL; _rid:=(OLD).id::TEXT;
  END IF;
  INSERT INTO public.audit_log(usuario_id, operacao, tabela, registro_id, valor_anterior, valor_novo)
  VALUES (auth.uid(), _op, TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME, _rid, _old, _new);
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_audit_row() FROM PUBLIC, anon, authenticated;

-- Ativa auditoria nas tabelas críticas de identidade
CREATE TRIGGER audit_usuarios AFTER INSERT OR UPDATE OR DELETE ON public.usuarios FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_perfis AFTER INSERT OR UPDATE OR DELETE ON public.perfis FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_permissoes AFTER INSERT OR UPDATE OR DELETE ON public.permissoes FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_perfil_permissoes AFTER INSERT OR UPDATE OR DELETE ON public.perfil_permissoes FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_usuario_permissoes AFTER INSERT OR UPDATE OR DELETE ON public.usuario_permissoes FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_usuario_unidades AFTER INSERT OR UPDATE OR DELETE ON public.usuario_unidades FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();
CREATE TRIGGER audit_usuario_secretarias AFTER INSERT OR UPDATE OR DELETE ON public.usuario_secretarias FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- =================== PERMISSÕES NOVAS ===================
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria, ativa)
SELECT v.codigo, v.nome, v.descricao, v.modulo::public.modulo_sistema, v.categoria::public.categoria_permissao, true
FROM (VALUES
  ('documento.upload','Enviar documento','Upload de documentos ao sistema','documento','criacao'),
  ('documento.download','Baixar documento','Download de documentos','documento','visualizacao'),
  ('documento.excluir','Excluir documento','Exclusão lógica de documentos','documento','exclusao'),
  ('notificacao.enviar','Enviar notificação','Disparar notificações aos usuários','notificacao','acao'),
  ('assinatura.gerenciar','Gerenciar assinaturas','Cadastrar e manter assinaturas institucionais','assinatura','administracao'),
  ('auditoria.visualizar','Visualizar auditoria','Acesso aos registros de auditoria do sistema','auditoria','visualizacao')
) AS v(codigo, nome, descricao, modulo, categoria)
WHERE NOT EXISTS (SELECT 1 FROM public.permissoes p WHERE p.codigo = v.codigo AND p.deleted_at IS NULL);

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true FROM public.perfis p, public.permissoes pm
WHERE (
  (p.codigo='MASTER' AND pm.codigo IN ('documento.upload','documento.download','documento.excluir','notificacao.enviar','assinatura.gerenciar','auditoria.visualizar')) OR
  (p.codigo='GESTOR' AND pm.codigo IN ('documento.upload','documento.download','notificacao.enviar','assinatura.gerenciar','auditoria.visualizar')) OR
  (p.codigo='DIRETOR_UNIDADE' AND pm.codigo IN ('documento.upload','documento.download','notificacao.enviar')) OR
  (p.codigo='ADMINISTRATIVO' AND pm.codigo IN ('documento.upload','documento.download')) OR
  (p.codigo='CONSULTA' AND pm.codigo IN ('documento.download'))
)
AND NOT EXISTS (SELECT 1 FROM public.perfil_permissoes pp WHERE pp.perfil_id=p.id AND pp.permissao_id=pm.id);