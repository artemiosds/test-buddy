
-- =====================================================================
-- MIGRATION 02.06 — SEEDS DE PERFIS, PERMISSÕES E MAPEAMENTO
-- =====================================================================

-- ---------------------------------------------------------------------
-- PERFIS PADRÃO
-- ---------------------------------------------------------------------
INSERT INTO public.perfis (codigo, nome, descricao, nivel_hierarquico, is_sistema) VALUES
  ('MASTER',           'Administrador Master',    'Acesso irrestrito a todo o sistema',                       10,  true),
  ('GESTOR',           'Gestor',                   'Gestão da secretaria e todas as unidades vinculadas',      20,  true),
  ('DIRETOR_UNIDADE',  'Diretor de Unidade',       'Responsável pela gestão de uma unidade específica',        30,  true),
  ('ADMINISTRATIVO',   'Operacional Administrativo','Operação diária de frequência, documentos e cadastros',   40,  true),
  ('CONSULTA',         'Consulta',                 'Acesso apenas para visualização e exportação',             50,  true)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- CATÁLOGO DE PERMISSÕES
-- ---------------------------------------------------------------------
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria) VALUES
  -- Dashboard
  ('dashboard.visualizar',      'Visualizar Dashboard',      'Acessar o painel inicial',                       'dashboard',    'visualizacao'),

  -- Competência
  ('competencia.visualizar',    'Visualizar Competências',   'Listar competências',                            'competencia',  'visualizacao'),
  ('competencia.criar',         'Criar Competência',         'Abrir nova competência mensal',                  'competencia',  'criacao'),
  ('competencia.editar',        'Editar Competência',        'Alterar dados da competência',                   'competencia',  'edicao'),
  ('competencia.encerrar',      'Encerrar Competência',      'Finalizar competência mensal',                   'competencia',  'acao'),
  ('competencia.reabrir',       'Reabrir Competência',       'Reabrir competência encerrada',                  'competencia',  'acao'),
  ('competencia.excluir',       'Excluir Competência',       'Remover competência',                            'competencia',  'exclusao'),

  -- Frequência
  ('frequencia.visualizar',     'Visualizar Frequência',     'Consultar folhas de frequência',                 'frequencia',   'visualizacao'),
  ('frequencia.criar',          'Criar Frequência',          'Iniciar folha de frequência',                    'frequencia',   'criacao'),
  ('frequencia.editar',         'Editar Frequência',         'Alterar itens de frequência',                    'frequencia',   'edicao'),
  ('frequencia.enviar',         'Enviar Frequência',         'Submeter para análise',                          'frequencia',   'acao'),
  ('frequencia.analisar',       'Analisar Frequência',       'Analisar folhas submetidas',                     'frequencia',   'acao'),
  ('frequencia.aprovar',        'Aprovar Frequência',        'Aprovar folha analisada',                        'frequencia',   'aprovacao'),
  ('frequencia.rejeitar',       'Rejeitar Frequência',       'Rejeitar folha analisada',                       'frequencia',   'aprovacao'),
  ('frequencia.arquivar',       'Arquivar Frequência',       'Arquivar folha aprovada',                        'frequencia',   'acao'),
  ('frequencia.exportar',       'Exportar Frequência',       'Exportar folha em PDF/CSV',                      'frequencia',   'exportacao'),
  ('frequencia.excluir',        'Excluir Frequência',        'Remover folha',                                  'frequencia',   'exclusao'),

  -- Relatório
  ('relatorio.visualizar',      'Visualizar Relatórios',     'Consultar relatórios',                           'relatorio',    'visualizacao'),
  ('relatorio.exportar',        'Exportar Relatórios',       'Exportar relatórios',                            'relatorio',    'exportacao'),

  -- Documento
  ('documento.visualizar',      'Visualizar Documentos',     'Consultar documentos',                           'documento',    'visualizacao'),
  ('documento.upload',          'Enviar Documento',          'Fazer upload de arquivos',                       'documento',    'criacao'),
  ('documento.download',        'Baixar Documento',          'Fazer download de arquivos',                     'documento',    'exportacao'),
  ('documento.excluir',         'Excluir Documento',         'Remover documento',                              'documento',    'exclusao'),

  -- Notificação
  ('notificacao.visualizar',    'Visualizar Notificações',   'Consultar notificações',                         'notificacao',  'visualizacao'),
  ('notificacao.enviar',        'Enviar Notificação',        'Enviar notificação a outros usuários',           'notificacao',  'acao'),

  -- Assinatura
  ('assinatura.gerenciar',      'Gerenciar Assinaturas',     'Gerenciar assinaturas institucionais',           'assinatura',   'administracao'),
  ('assinatura.aplicar',        'Aplicar Assinatura',        'Aplicar assinatura em documentos',               'assinatura',   'acao'),

  -- Profissional
  ('profissional.visualizar',   'Visualizar Profissionais',  'Listar profissionais',                           'profissional', 'visualizacao'),
  ('profissional.criar',        'Cadastrar Profissional',    'Cadastrar novo profissional',                    'profissional', 'criacao'),
  ('profissional.editar',       'Editar Profissional',       'Alterar dados de profissional',                  'profissional', 'edicao'),
  ('profissional.excluir',      'Excluir Profissional',      'Remover profissional',                           'profissional', 'exclusao'),

  -- Unidade
  ('unidade.visualizar',        'Visualizar Unidades',       'Listar unidades',                                'unidade',      'visualizacao'),
  ('unidade.gerenciar',         'Gerenciar Unidades',        'Criar/editar unidades e setores',                'unidade',      'administracao'),

  -- Secretaria
  ('secretaria.visualizar',     'Visualizar Secretarias',    'Listar secretarias',                             'secretaria',   'visualizacao'),
  ('secretaria.gerenciar',      'Gerenciar Secretarias',     'Criar/editar secretarias',                       'secretaria',   'administracao'),

  -- Usuário
  ('usuario.visualizar',        'Visualizar Usuários',       'Listar usuários',                                'usuario',      'visualizacao'),
  ('usuario.gerenciar',         'Gerenciar Usuários',        'Criar/editar usuários e vínculos',               'usuario',      'administracao'),

  -- Perfil
  ('perfil.visualizar',         'Visualizar Perfis',         'Listar perfis',                                  'perfil',       'visualizacao'),
  ('perfil.gerenciar',          'Gerenciar Perfis',          'Criar/editar perfis e suas permissões padrão',   'perfil',       'administracao'),

  -- Permissão
  ('permissao.visualizar',      'Visualizar Permissões',     'Listar catálogo de permissões',                  'permissao',    'visualizacao'),
  ('permissao.gerenciar',       'Gerenciar Permissões',      'Criar/editar permissões e conceder a usuários',  'permissao',    'administracao'),

  -- Auditoria
  ('auditoria.visualizar',      'Visualizar Auditoria',      'Consultar registros de auditoria',               'auditoria',    'visualizacao'),
  ('auditoria.exportar',        'Exportar Auditoria',        'Exportar registros de auditoria',                'auditoria',    'exportacao'),

  -- Configuração
  ('configuracao.visualizar',   'Visualizar Configurações',  'Consultar configurações do sistema',             'configuracao', 'visualizacao'),
  ('configuracao.editar',       'Editar Configurações',      'Alterar configurações do sistema/município',     'configuracao', 'administracao'),

  -- Sistema
  ('sistema.administrar',       'Administrar Sistema',       'Operações administrativas gerais',               'sistema',      'administracao')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- MAPEAMENTO PERFIL x PERMISSÕES
-- ---------------------------------------------------------------------

-- MASTER: todas
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p, public.permissoes pm
WHERE p.codigo = 'MASTER'
ON CONFLICT DO NOTHING;

-- GESTOR: todas exceto administração de sistema/permissões brutas
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p, public.permissoes pm
WHERE p.codigo = 'GESTOR'
  AND pm.codigo NOT IN ('sistema.administrar','permissao.gerenciar')
ON CONFLICT DO NOTHING;

-- DIRETOR_UNIDADE: gestão da sua unidade
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p, public.permissoes pm
WHERE p.codigo = 'DIRETOR_UNIDADE'
  AND pm.codigo IN (
    'dashboard.visualizar',
    'competencia.visualizar',
    'frequencia.visualizar','frequencia.criar','frequencia.editar','frequencia.enviar','frequencia.exportar','frequencia.analisar','frequencia.aprovar','frequencia.rejeitar',
    'relatorio.visualizar','relatorio.exportar',
    'documento.visualizar','documento.upload','documento.download',
    'notificacao.visualizar','notificacao.enviar',
    'profissional.visualizar','profissional.editar',
    'unidade.visualizar',
    'usuario.visualizar',
    'assinatura.aplicar'
  )
ON CONFLICT DO NOTHING;

-- ADMINISTRATIVO: operação diária
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p, public.permissoes pm
WHERE p.codigo = 'ADMINISTRATIVO'
  AND pm.codigo IN (
    'dashboard.visualizar',
    'competencia.visualizar',
    'frequencia.visualizar','frequencia.criar','frequencia.editar','frequencia.enviar','frequencia.exportar',
    'relatorio.visualizar','relatorio.exportar',
    'documento.visualizar','documento.upload','documento.download',
    'notificacao.visualizar',
    'profissional.visualizar','profissional.editar','profissional.criar',
    'unidade.visualizar',
    'usuario.visualizar'
  )
ON CONFLICT DO NOTHING;

-- CONSULTA: somente leitura e exportação
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p, public.permissoes pm
WHERE p.codigo = 'CONSULTA'
  AND pm.categoria IN ('visualizacao','exportacao')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Trigger: quando um novo usuário for cadastrado E não tiver perfil,
-- atribui automaticamente MASTER se for o primeiro, CONSULTA caso contrário
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_usuarios_atribuir_perfil_padrao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _perfil UUID;
BEGIN
  IF NEW.perfil_id IS NULL THEN
    IF NEW.acesso_todas_unidades AND NEW.acesso_todas_secretarias THEN
      SELECT id INTO _perfil FROM public.perfis WHERE codigo = 'MASTER';
    ELSE
      SELECT id INTO _perfil FROM public.perfis WHERE codigo = 'CONSULTA';
    END IF;
    NEW.perfil_id := _perfil;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tg_usuarios_atribuir_perfil_padrao() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_usuarios_perfil_padrao
  BEFORE INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.tg_usuarios_atribuir_perfil_padrao();
