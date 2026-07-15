
-- Garante unicidade do código (idempotente)
CREATE UNIQUE INDEX IF NOT EXISTS permissoes_codigo_uniq ON public.permissoes (codigo);

-- Inserções por código faltante (evita ON CONFLICT sem constraint nomeada)
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria, ativa, is_sistema)
SELECT v.codigo, v.nome, v.descricao, v.modulo::modulo_sistema, v.categoria::categoria_permissao, true, true
FROM (VALUES
  ('competencia.arquivar', 'Arquivar competência',   'Move competência para status arquivada',              'competencia', 'acao'),
  ('frequencia.reabrir',   'Reabrir frequência',     'Retorna frequência a rascunho após envio/aprovação',  'frequencia',  'acao'),
  ('pendencia.criar',      'Criar pendência',        'Abre pendência em linha de frequência',               'frequencia',  'acao'),
  ('pendencia.responder',  'Responder pendência',    'Registra justificativa/correção do gestor',           'frequencia',  'acao'),
  ('pendencia.resolver',   'Resolver pendência',     'Resolve ou reabre pendência analisada',               'frequencia',  'acao'),
  ('usuario.criar',        'Criar usuário',          'Cria conta no sistema',                                'usuario',     'administracao'),
  ('usuario.editar',       'Editar usuário',         'Atualiza dados cadastrais do usuário',                 'usuario',     'administracao'),
  ('usuario.inativar',     'Inativar usuário',       'Inativa/bloqueia/exclui conta',                        'usuario',     'administracao'),
  ('usuario.permissoes',   'Gerenciar permissões',   'Concede/revoga permissões individuais',                'permissao',   'administracao')
) AS v(codigo, nome, descricao, modulo, categoria)
WHERE NOT EXISTS (SELECT 1 FROM public.permissoes p WHERE p.codigo = v.codigo);

-- Reativa códigos previamente desativados/soft-deletados
UPDATE public.permissoes SET ativa = true, is_sistema = true, deleted_at = NULL
WHERE codigo IN (
  'competencia.arquivar','frequencia.reabrir',
  'pendencia.criar','pendencia.responder','pendencia.resolver',
  'usuario.criar','usuario.editar','usuario.inativar','usuario.permissoes'
);

-- Concede automaticamente ao perfil MASTER
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT pf.id, pm.id, true
FROM public.perfis pf
CROSS JOIN public.permissoes pm
WHERE pf.codigo = 'MASTER'
  AND pm.codigo IN (
    'competencia.arquivar','frequencia.reabrir',
    'pendencia.criar','pendencia.responder','pendencia.resolver',
    'usuario.criar','usuario.editar','usuario.inativar','usuario.permissoes'
  )
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;

-- Barramento de eventos
CREATE TABLE IF NOT EXISTS public.eventos_dominio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL,
  agregado TEXT NOT NULL,
  agregado_id TEXT,
  dados JSONB NOT NULL DEFAULT '{}'::jsonb,
  emitido_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_dominio_tipo_idx        ON public.eventos_dominio (tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS eventos_dominio_agregado_idx    ON public.eventos_dominio (agregado, agregado_id, created_at DESC);
CREATE INDEX IF NOT EXISTS eventos_dominio_emitido_por_idx ON public.eventos_dominio (emitido_por, created_at DESC);

GRANT SELECT ON public.eventos_dominio TO authenticated;
GRANT ALL    ON public.eventos_dominio TO service_role;

ALTER TABLE public.eventos_dominio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eventos_select_master_ou_auditoria" ON public.eventos_dominio;
CREATE POLICY "eventos_select_master_ou_auditoria"
ON public.eventos_dominio
FOR SELECT
TO authenticated
USING (
  public.is_master(auth.uid())
  OR public.has_permission(auth.uid(), 'auditoria.visualizar', NULL, NULL)
);

CREATE OR REPLACE FUNCTION public.emit_evento(
  _tipo TEXT,
  _agregado TEXT,
  _agregado_id TEXT DEFAULT NULL,
  _dados JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _id UUID;
BEGIN
  IF _tipo IS NULL OR length(trim(_tipo)) = 0 THEN
    RAISE EXCEPTION 'tipo do evento é obrigatório';
  END IF;
  IF _agregado IS NULL OR length(trim(_agregado)) = 0 THEN
    RAISE EXCEPTION 'agregado do evento é obrigatório';
  END IF;

  INSERT INTO public.eventos_dominio (tipo, agregado, agregado_id, dados, emitido_por)
  VALUES (_tipo, _agregado, _agregado_id, COALESCE(_dados, '{}'::jsonb), auth.uid())
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

REVOKE ALL ON FUNCTION public.emit_evento(TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_evento(TEXT, TEXT, TEXT, JSONB) TO authenticated, service_role;
