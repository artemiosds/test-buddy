
-- ENUMs do domínio
DO $$ BEGIN
  CREATE TYPE public.pendencia_categoria AS ENUM ('frequencia','documento','ponto','folha','geral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.pendencia_prioridade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.pendencia_status AS ENUM (
    'aberta','em_analise','aguardando_resposta','respondida','resolvida','reaberta','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Contador de numeração
CREATE TABLE IF NOT EXISTS public.pendencia_numeros (
  secretaria_id UUID NOT NULL REFERENCES public.secretarias(id) ON DELETE CASCADE,
  ano           INT  NOT NULL,
  ultimo        INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (secretaria_id, ano)
);
GRANT SELECT ON public.pendencia_numeros TO authenticated;
GRANT ALL    ON public.pendencia_numeros TO service_role;
ALTER TABLE public.pendencia_numeros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pnum_select ON public.pendencia_numeros;
CREATE POLICY pnum_select ON public.pendencia_numeros FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.proximo_numero_pendencia(_secretaria_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $fn$
DECLARE _ano INT := EXTRACT(YEAR FROM now())::int; _sigla TEXT; _n INT;
BEGIN
  SELECT COALESCE(NULLIF(sigla,''),'SMS') INTO _sigla FROM public.secretarias WHERE id=_secretaria_id;
  IF _sigla IS NULL THEN _sigla := 'SMS'; END IF;
  INSERT INTO public.pendencia_numeros(secretaria_id, ano, ultimo)
    VALUES (_secretaria_id, _ano, 1)
  ON CONFLICT (secretaria_id, ano) DO UPDATE
    SET ultimo = public.pendencia_numeros.ultimo + 1
  RETURNING ultimo INTO _n;
  RETURN _sigla || '-' || _ano || '-' || LPAD(_n::text, 5, '0');
END $fn$;
REVOKE ALL ON FUNCTION public.proximo_numero_pendencia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.proximo_numero_pendencia(uuid) TO authenticated, service_role;

-- Tabela principal
CREATE TABLE IF NOT EXISTS public.pendencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero            TEXT NOT NULL UNIQUE,
  categoria         public.pendencia_categoria  NOT NULL DEFAULT 'geral',
  prioridade        public.pendencia_prioridade NOT NULL DEFAULT 'media',
  status            public.pendencia_status     NOT NULL DEFAULT 'aberta',
  titulo            TEXT NOT NULL,
  descricao         TEXT,
  secretaria_id     UUID REFERENCES public.secretarias(id) ON DELETE SET NULL,
  unidade_id        UUID REFERENCES public.unidades(id)    ON DELETE SET NULL,
  origem_tipo       TEXT,
  origem_id         UUID,
  frequencia_id     UUID REFERENCES public.frequencias(id) ON DELETE SET NULL,
  frequencia_profissional_id UUID REFERENCES public.frequencia_profissional(id) ON DELETE SET NULL,
  responsavel_id    UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  prazo             DATE,
  sla_horas         INT,
  aberta_em         TIMESTAMPTZ NOT NULL DEFAULT now(),
  respondida_em     TIMESTAMPTZ,
  resolvida_em      TIMESTAMPTZ,
  reabertura_em     TIMESTAMPTZ,
  cancelada_em      TIMESTAMPTZ,
  correlation_id    UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,
  created_by        UUID REFERENCES public.usuarios(id),
  updated_by        UUID REFERENCES public.usuarios(id),
  deleted_by        UUID REFERENCES public.usuarios(id)
);
CREATE INDEX IF NOT EXISTS pendencias_status_idx      ON public.pendencias(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS pendencias_secretaria_idx  ON public.pendencias(secretaria_id);
CREATE INDEX IF NOT EXISTS pendencias_unidade_idx     ON public.pendencias(unidade_id);
CREATE INDEX IF NOT EXISTS pendencias_responsavel_idx ON public.pendencias(responsavel_id);
CREATE INDEX IF NOT EXISTS pendencias_frequencia_idx  ON public.pendencias(frequencia_id);
CREATE INDEX IF NOT EXISTS pendencias_freqprof_idx    ON public.pendencias(frequencia_profissional_id);
CREATE INDEX IF NOT EXISTS pendencias_corr_idx        ON public.pendencias(correlation_id);

GRANT SELECT ON public.pendencias TO authenticated;
GRANT ALL    ON public.pendencias TO service_role;
ALTER TABLE public.pendencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pendencias_select ON public.pendencias;
CREATE POLICY pendencias_select ON public.pendencias FOR SELECT TO authenticated
USING (
  public.is_master(auth.uid())
  OR (
    public.has_permission(auth.uid(), 'pendencia.visualizar', unidade_id, secretaria_id)
    AND (unidade_id IS NULL OR public.user_has_unit(auth.uid(), unidade_id))
    AND (secretaria_id IS NULL OR public.user_has_secretaria(auth.uid(), secretaria_id))
  )
);

DROP TRIGGER IF EXISTS tg_pendencias_updated_at ON public.pendencias;
CREATE TRIGGER tg_pendencias_updated_at BEFORE UPDATE ON public.pendencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
DROP TRIGGER IF EXISTS tg_pendencias_audit ON public.pendencias;
CREATE TRIGGER tg_pendencias_audit AFTER INSERT OR UPDATE OR DELETE ON public.pendencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

-- Histórico
CREATE TABLE IF NOT EXISTS public.pendencia_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pendencia_id    UUID NOT NULL REFERENCES public.pendencias(id) ON DELETE CASCADE,
  acao            TEXT NOT NULL,
  status_anterior public.pendencia_status,
  status_novo     public.pendencia_status,
  comentario      TEXT,
  autor_id        UUID REFERENCES public.usuarios(id),
  evento_id       UUID,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pend_hist_pendencia_idx ON public.pendencia_historico(pendencia_id);
GRANT SELECT ON public.pendencia_historico TO authenticated;
GRANT ALL    ON public.pendencia_historico TO service_role;
ALTER TABLE public.pendencia_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pend_hist_select ON public.pendencia_historico;
CREATE POLICY pend_hist_select ON public.pendencia_historico FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.pendencias p
    WHERE p.id = pendencia_historico.pendencia_id
      AND (
        public.is_master(auth.uid())
        OR public.has_permission(auth.uid(), 'pendencia.visualizar', p.unidade_id, p.secretaria_id)
      )
  )
);

-- Permissões
INSERT INTO public.permissoes (codigo, nome, descricao, ativa, modulo, categoria)
VALUES
  ('pendencia.visualizar', 'Visualizar pendências', 'Ver pendências institucionais no escopo permitido', true, 'pendencia'::public.modulo_sistema, 'visualizacao'::public.categoria_permissao),
  ('pendencia.atribuir',   'Atribuir responsável',  'Definir/alterar o responsável da pendência',        true, 'pendencia'::public.modulo_sistema, 'edicao'::public.categoria_permissao),
  ('pendencia.cancelar',   'Cancelar pendência',    'Encerrar uma pendência sem resolução',              true, 'pendencia'::public.modulo_sistema, 'acao'::public.categoria_permissao)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
FROM public.perfis p, public.permissoes pe
WHERE p.codigo='MASTER' AND pe.codigo IN ('pendencia.visualizar','pendencia.atribuir','pendencia.cancelar')
ON CONFLICT DO NOTHING;

-- Migração de dados legado -> novo
DO $mig$
DECLARE
  fp RECORD; _sec UUID; _uni UUID; _num TEXT; _st public.pendencia_status;
BEGIN
  FOR fp IN SELECT * FROM public.frequencia_pendencias WHERE deleted_at IS NULL LOOP
    SELECT u.secretaria_id, u.id INTO _sec, _uni
    FROM public.frequencias f
    JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
    JOIN public.unidades u ON u.id = cu.unidade_id
    WHERE f.id = fp.frequencia_id;
    IF _sec IS NULL THEN CONTINUE; END IF;
    _num := public.proximo_numero_pendencia(_sec);
    _st := CASE fp.status::text
      WHEN 'aberta'    THEN 'aberta'::public.pendencia_status
      WHEN 'respondida'THEN 'respondida'::public.pendencia_status
      WHEN 'resolvida' THEN 'resolvida'::public.pendencia_status
      WHEN 'reaberta'  THEN 'reaberta'::public.pendencia_status
      ELSE 'aberta'::public.pendencia_status
    END;
    INSERT INTO public.pendencias(
      numero, categoria, prioridade, status, titulo, descricao,
      secretaria_id, unidade_id, origem_tipo, origem_id,
      frequencia_id, frequencia_profissional_id,
      aberta_em, respondida_em, resolvida_em, created_by, updated_by
    ) VALUES (
      _num, 'frequencia', 'media', _st, fp.titulo, fp.descricao,
      _sec, _uni, 'frequencia', fp.frequencia_id,
      fp.frequencia_id, fp.frequencia_profissional_id,
      fp.created_at, fp.data_resposta, fp.data_resolucao,
      fp.aberta_por, fp.updated_by
    );
  END LOOP;
END $mig$;

REVOKE INSERT, UPDATE, DELETE ON public.frequencia_pendencias FROM authenticated, anon;
COMMENT ON TABLE public.frequencia_pendencias IS 'LEGADO: migrado para public.pendencias em 2026-07. Somente leitura.';
