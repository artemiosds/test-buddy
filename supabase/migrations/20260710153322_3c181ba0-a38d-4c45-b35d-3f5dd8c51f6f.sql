
DO $$ BEGIN
  CREATE TYPE public.status_profissional AS ENUM ('ativo','afastado','ferias','licenca','desligado','inativo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_evento_funcional AS ENUM (
    'admissao','transferencia','promocao','mudanca_cargo','mudanca_funcao',
    'mudanca_vinculo','afastamento','retorno','ferias','licenca','desligamento','outro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profissionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf VARCHAR(11) NOT NULL,
  nome_completo TEXT NOT NULL,
  nome_social TEXT,
  data_nascimento DATE,
  sexo VARCHAR(1) CHECK (sexo IN ('M','F','O')),
  email TEXT,
  telefone VARCHAR(20),
  foto_url TEXT,
  matricula VARCHAR(50),
  pis_pasep VARCHAR(20),
  rg VARCHAR(30),
  rg_orgao VARCHAR(20),
  rg_uf VARCHAR(2),
  cns VARCHAR(15),
  conselho_classe VARCHAR(20),
  conselho_numero VARCHAR(30),
  conselho_uf VARCHAR(2),
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE RESTRICT,
  unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL,
  setor_id UUID REFERENCES public.setores(id) ON DELETE SET NULL,
  cargo_id UUID REFERENCES public.cargos(id) ON DELETE SET NULL,
  funcao_id UUID REFERENCES public.funcoes(id) ON DELETE SET NULL,
  vinculo_id UUID REFERENCES public.vinculos(id) ON DELETE SET NULL,
  data_admissao DATE,
  data_desligamento DATE,
  carga_horaria_semanal SMALLINT CHECK (carga_horaria_semanal IS NULL OR carga_horaria_semanal BETWEEN 1 AND 80),
  status public.status_profissional NOT NULL DEFAULT 'ativo',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  CONSTRAINT profissionais_cpf_chk CHECK (cpf ~ '^[0-9]{11}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_profissionais_cpf_ativo ON public.profissionais(cpf) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_profissionais_secretaria ON public.profissionais(secretaria_id);
CREATE INDEX IF NOT EXISTS ix_profissionais_unidade ON public.profissionais(unidade_id);
CREATE INDEX IF NOT EXISTS ix_profissionais_setor ON public.profissionais(setor_id);
CREATE INDEX IF NOT EXISTS ix_profissionais_vinculo ON public.profissionais(vinculo_id);
CREATE INDEX IF NOT EXISTS ix_profissionais_status ON public.profissionais(status);
CREATE INDEX IF NOT EXISTS ix_profissionais_nome ON public.profissionais(nome_completo);
CREATE INDEX IF NOT EXISTS ix_profissionais_matricula ON public.profissionais(matricula) WHERE matricula IS NOT NULL;

CREATE TRIGGER trg_profissionais_updated_at BEFORE UPDATE ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_profissionais_updated_by BEFORE INSERT OR UPDATE ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY profissionais_select ON public.profissionais FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND (
      public.is_master(auth.uid())
      OR (
        public.user_has_secretaria(auth.uid(), secretaria_id)
        AND (unidade_id IS NULL OR public.user_has_unit(auth.uid(), unidade_id))
        AND public.has_permission(auth.uid(), 'profissional.visualizar', unidade_id, secretaria_id)
      )
    )
  );

CREATE POLICY profissionais_insert ON public.profissionais FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master(auth.uid())
    OR (public.user_has_secretaria(auth.uid(), secretaria_id)
        AND public.has_permission(auth.uid(), 'profissional.criar', unidade_id, secretaria_id))
  );

CREATE POLICY profissionais_update ON public.profissionais FOR UPDATE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR (public.user_has_secretaria(auth.uid(), secretaria_id)
        AND public.has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id))
  )
  WITH CHECK (
    public.is_master(auth.uid())
    OR (public.user_has_secretaria(auth.uid(), secretaria_id)
        AND public.has_permission(auth.uid(), 'profissional.editar', unidade_id, secretaria_id))
  );

CREATE POLICY profissionais_delete ON public.profissionais FOR DELETE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'profissional.excluir', unidade_id, secretaria_id)
  );

CREATE TABLE IF NOT EXISTS public.profissional_historico_funcional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  tipo_evento public.tipo_evento_funcional NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  secretaria_anterior_id UUID REFERENCES public.secretarias(id),
  unidade_anterior_id UUID REFERENCES public.unidades(id),
  setor_anterior_id UUID REFERENCES public.setores(id),
  cargo_anterior_id UUID REFERENCES public.cargos(id),
  funcao_anterior_id UUID REFERENCES public.funcoes(id),
  vinculo_anterior_id UUID REFERENCES public.vinculos(id),
  carga_horaria_anterior SMALLINT,
  status_anterior public.status_profissional,
  secretaria_novo_id UUID REFERENCES public.secretarias(id),
  unidade_novo_id UUID REFERENCES public.unidades(id),
  setor_novo_id UUID REFERENCES public.setores(id),
  cargo_novo_id UUID REFERENCES public.cargos(id),
  funcao_novo_id UUID REFERENCES public.funcoes(id),
  vinculo_novo_id UUID REFERENCES public.vinculos(id),
  carga_horaria_nova SMALLINT,
  status_novo public.status_profissional,
  motivo TEXT,
  documento_referencia TEXT,
  documento_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id),
  CONSTRAINT historico_datas_chk CHECK (data_fim IS NULL OR data_fim >= data_inicio)
);

CREATE INDEX IF NOT EXISTS ix_historico_profissional ON public.profissional_historico_funcional(profissional_id);
CREATE INDEX IF NOT EXISTS ix_historico_tipo ON public.profissional_historico_funcional(tipo_evento);
CREATE INDEX IF NOT EXISTS ix_historico_data ON public.profissional_historico_funcional(data_inicio);

CREATE TRIGGER trg_historico_updated_at BEFORE UPDATE ON public.profissional_historico_funcional
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_historico_updated_by BEFORE INSERT OR UPDATE ON public.profissional_historico_funcional
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissional_historico_funcional TO authenticated;
GRANT ALL ON public.profissional_historico_funcional TO service_role;
ALTER TABLE public.profissional_historico_funcional ENABLE ROW LEVEL SECURITY;

CREATE POLICY historico_select ON public.profissional_historico_funcional FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND (
        public.is_master(auth.uid())
        OR (public.user_has_secretaria(auth.uid(), p.secretaria_id)
            AND public.has_permission(auth.uid(), 'historico.visualizar', p.unidade_id, p.secretaria_id))
      )
    )
  );

CREATE POLICY historico_insert ON public.profissional_historico_funcional FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND (
      public.is_master(auth.uid())
      OR public.has_permission(auth.uid(), 'historico.gerenciar', p.unidade_id, p.secretaria_id)
    ))
  );

CREATE POLICY historico_update ON public.profissional_historico_funcional FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND (
      public.is_master(auth.uid())
      OR public.has_permission(auth.uid(), 'historico.gerenciar', p.unidade_id, p.secretaria_id)
    ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND (
      public.is_master(auth.uid())
      OR public.has_permission(auth.uid(), 'historico.gerenciar', p.unidade_id, p.secretaria_id)
    ))
  );

CREATE POLICY historico_delete ON public.profissional_historico_funcional FOR DELETE TO authenticated
  USING (
    public.is_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id
       AND public.has_permission(auth.uid(), 'historico.gerenciar', p.unidade_id, p.secretaria_id))
  );

CREATE TABLE IF NOT EXISTS public.documento_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  parent_id UUID REFERENCES public.documento_categorias(id) ON DELETE SET NULL,
  icone VARCHAR(50),
  cor VARCHAR(7),
  ordem SMALLINT NOT NULL DEFAULT 0,
  ativa BOOLEAN NOT NULL DEFAULT true,
  escopo VARCHAR(30) NOT NULL DEFAULT 'geral'
    CHECK (escopo IN ('geral','profissional','frequencia','competencia','unidade','institucional')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  deleted_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS ix_documento_categorias_parent ON public.documento_categorias(parent_id);
CREATE INDEX IF NOT EXISTS ix_documento_categorias_escopo ON public.documento_categorias(escopo);

CREATE TRIGGER trg_documento_categorias_updated_at BEFORE UPDATE ON public.documento_categorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_documento_categorias_updated_by BEFORE INSERT OR UPDATE ON public.documento_categorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_by();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.documento_categorias TO authenticated;
GRANT ALL ON public.documento_categorias TO service_role;
ALTER TABLE public.documento_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY documento_categorias_select ON public.documento_categorias FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY documento_categorias_manage ON public.documento_categorias FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'configuracao.editar'))
  WITH CHECK (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'configuracao.editar'));

-- Novas permissões (formato modulo.acao — sem múltiplos pontos)
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria, ativa)
SELECT v.codigo, v.nome, v.descricao, v.modulo::public.modulo_sistema, v.categoria::public.categoria_permissao, true
FROM (VALUES
  ('profissional.visualizar','Visualizar profissionais','Permite listar e visualizar profissionais','profissional','visualizacao'),
  ('profissional.criar','Cadastrar profissional','Permite cadastrar novos profissionais','profissional','criacao'),
  ('profissional.editar','Editar profissional','Permite editar dados de profissionais','profissional','edicao'),
  ('profissional.excluir','Excluir profissional','Permite excluir (soft delete) profissionais','profissional','exclusao'),
  ('historico.visualizar','Visualizar histórico funcional','Permite ver o histórico funcional do profissional','profissional','visualizacao'),
  ('historico.gerenciar','Gerenciar histórico funcional','Permite registrar e editar eventos do histórico','profissional','edicao'),
  ('categoria.gerenciar','Gerenciar categorias de documentos','Permite criar e editar categorias de documentos','documento','administracao')
) AS v(codigo, nome, descricao, modulo, categoria)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissoes p WHERE p.codigo = v.codigo AND p.deleted_at IS NULL
);

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true FROM public.perfis p CROSS JOIN public.permissoes pm
WHERE pm.codigo IN ('profissional.visualizar','historico.visualizar')
  AND p.codigo IN ('MASTER','GESTOR','DIRETOR_UNIDADE','ADMINISTRATIVO','CONSULTA')
ON CONFLICT (perfil_id, permissao_id) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true FROM public.perfis p CROSS JOIN public.permissoes pm
WHERE pm.codigo IN ('profissional.criar','profissional.editar','historico.gerenciar')
  AND p.codigo IN ('MASTER','GESTOR','DIRETOR_UNIDADE','ADMINISTRATIVO')
ON CONFLICT (perfil_id, permissao_id) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true FROM public.perfis p CROSS JOIN public.permissoes pm
WHERE pm.codigo IN ('profissional.excluir','categoria.gerenciar')
  AND p.codigo IN ('MASTER','GESTOR')
ON CONFLICT (perfil_id, permissao_id) DO NOTHING;

INSERT INTO public.documento_categorias (codigo, nome, descricao, escopo, ordem, icone) VALUES
  ('DOC_PESSOAIS','Documentos Pessoais','RG, CPF, comprovantes pessoais','profissional',10,'user'),
  ('DOC_VINCULO','Documentos de Vínculo','Portarias, contratos, termos de posse','profissional',20,'file-badge'),
  ('DOC_FORMACAO','Formação e Titulação','Diplomas, certificados, conselhos','profissional',30,'graduation-cap'),
  ('DOC_FREQUENCIA','Frequência','Folhas de frequência assinadas','frequencia',40,'calendar-check'),
  ('DOC_ATESTADOS','Atestados e Licenças','Atestados médicos, licenças, afastamentos','profissional',50,'file-heart'),
  ('DOC_COMPETENCIA','Documentos da Competência','Ofícios, memorandos, aprovações','competencia',60,'folder-open'),
  ('DOC_UNIDADE','Documentos da Unidade','Documentos institucionais da unidade','unidade',70,'building'),
  ('DOC_INSTITUCIONAL','Institucional','Documentos da secretaria/município','institucional',80,'landmark')
ON CONFLICT (codigo) DO NOTHING;
