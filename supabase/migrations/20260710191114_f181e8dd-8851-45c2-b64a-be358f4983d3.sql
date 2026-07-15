
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.perfil_permissoes'::regclass
      AND NOT tgisinternal
      AND tgname LIKE '%audit%'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.perfil_permissoes', r.tgname);
  END LOOP;
END $$;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo = 'MASTER' AND pe.ativa = true AND pe.deleted_at IS NULL
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo = 'GESTOR' AND pe.codigo IN (
  'dashboard.visualizar','unidade.visualizar','secretaria.visualizar',
  'profissional.visualizar','profissional.criar','profissional.editar',
  'historico.visualizar','historico.gerenciar',
  'competencia.visualizar','competencia.criar','competencia.editar','competencia.encerrar',
  'frequencia.visualizar','frequencia.analisar','frequencia.aprovar','frequencia.rejeitar','frequencia.arquivar','frequencia.exportar',
  'pendencia.gerenciar',
  'documento.visualizar','documento.download','documento.upload',
  'assinatura.aplicar',
  'relatorio.visualizar','relatorio.exportar',
  'notificacao.visualizar','notificacao.enviar',
  'perfil.visualizar','permissao.visualizar','usuario.visualizar'
)
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo = 'DIRETOR_UNIDADE' AND pe.codigo IN (
  'dashboard.visualizar','unidade.visualizar',
  'profissional.visualizar','historico.visualizar',
  'competencia.visualizar',
  'frequencia.visualizar','frequencia.criar','frequencia.editar','frequencia.enviar','frequencia.exportar',
  'pendencia.gerenciar',
  'documento.visualizar','documento.download','documento.upload',
  'relatorio.visualizar','relatorio.exportar',
  'notificacao.visualizar'
)
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo = 'ADMINISTRATIVO' AND pe.codigo IN (
  'dashboard.visualizar','unidade.visualizar',
  'profissional.visualizar','historico.visualizar',
  'competencia.visualizar',
  'frequencia.visualizar','frequencia.criar','frequencia.editar',
  'documento.visualizar','documento.download','documento.upload',
  'relatorio.visualizar','notificacao.visualizar'
)
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo = 'CONSULTA' AND pe.codigo IN (
  'dashboard.visualizar','unidade.visualizar',
  'profissional.visualizar','historico.visualizar',
  'competencia.visualizar','frequencia.visualizar',
  'documento.visualizar','documento.download',
  'relatorio.visualizar','notificacao.visualizar'
)
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;
