-- Etapa 4: snapshots imutáveis das regras financeiras no momento da aprovação
CREATE TABLE public.folha_financeira_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('efetivos','contratados')),
  registro_id uuid NOT NULL,
  competencia_id uuid,
  unidade_id uuid,
  setor_id uuid,
  parametros jsonb NOT NULL,
  aprovado_em timestamptz NOT NULL DEFAULT now(),
  aprovado_por uuid,
  ativo boolean NOT NULL DEFAULT true,
  substituido_em timestamptz,
  motivo_substituicao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ffs_registro ON public.folha_financeira_snapshots(registro_id, ativo);
CREATE INDEX idx_ffs_competencia ON public.folha_financeira_snapshots(competencia_id);
CREATE UNIQUE INDEX uq_ffs_registro_ativo ON public.folha_financeira_snapshots(tipo, registro_id) WHERE ativo;

GRANT SELECT ON public.folha_financeira_snapshots TO authenticated;
GRANT ALL ON public.folha_financeira_snapshots TO service_role;
ALTER TABLE public.folha_financeira_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY ffs_select ON public.folha_financeira_snapshots FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) OR public.has_permission(auth.uid(), 'relatorio.visualizar', NULL, NULL) OR public.has_permission(auth.uid(), 'configuracao.editar', NULL, NULL));

-- Imutabilidade: só é permitido desativar (ativo true->false) sem mudar o conteúdo; nunca excluir.
CREATE OR REPLACE FUNCTION public.tg_ffs_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Snapshots financeiros não podem ser excluídos'; END IF;
  IF NEW.parametros IS DISTINCT FROM OLD.parametros OR NEW.registro_id <> OLD.registro_id
     OR NEW.tipo <> OLD.tipo OR NEW.aprovado_em <> OLD.aprovado_em
     OR (OLD.ativo = false AND NEW.ativo = true) THEN
    RAISE EXCEPTION 'Snapshot financeiro é imutável';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ffs_imutavel BEFORE UPDATE OR DELETE ON public.folha_financeira_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_ffs_imutavel();

CREATE OR REPLACE FUNCTION public.ff_parametros_atuais() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'financeiro', COALESCE((SELECT parametros->'financeiro' FROM municipio_config WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1), '{}'::jsonb),
    'nivelPorCargo', COALESCE((SELECT jsonb_object_agg(id, nivel) FROM cargos WHERE deleted_at IS NULL), '{}'::jsonb),
    'capturado_em', now());
$$;
REVOKE ALL ON FUNCTION public.ff_parametros_atuais() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tg_ff_snapshot_aprovacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tipo text; v_comp uuid; v_uni uuid; v_setor uuid; v_por uuid;
BEGIN
  IF TG_TABLE_NAME = 'frequencias' THEN
    v_tipo := 'efetivos';
    SELECT cu.competencia_id, cu.unidade_id INTO v_comp, v_uni FROM competencia_unidades cu WHERE cu.id = NEW.competencia_unidade_id;
    v_setor := NEW.setor_id; v_por := COALESCE(NEW.aprovada_por, auth.uid());
  ELSE
    v_tipo := 'contratados'; v_comp := NEW.competencia_id; v_uni := NEW.unidade_id;
    v_por := COALESCE(NEW.aprovada_por, auth.uid());
  END IF;

  IF NEW.status = 'aprovada' AND OLD.status IS DISTINCT FROM 'aprovada' THEN
    -- Reaprovação: preserva a versão anterior (inativa) e registra a nova.
    UPDATE folha_financeira_snapshots SET ativo = false, substituido_em = now(), motivo_substituicao = 'reaprovacao'
      WHERE tipo = v_tipo AND registro_id = NEW.id AND ativo;
    INSERT INTO folha_financeira_snapshots(tipo, registro_id, competencia_id, unidade_id, setor_id, parametros, aprovado_por)
      VALUES (v_tipo, NEW.id, v_comp, v_uni, v_setor, ff_parametros_atuais(), v_por);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ff_snapshot_aprovacao() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_ff_snapshot_efetivos AFTER UPDATE OF status ON public.frequencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_ff_snapshot_aprovacao();
CREATE TRIGGER trg_ff_snapshot_contratados AFTER UPDATE OF status ON public.frequencias_contratados
  FOR EACH ROW EXECUTE FUNCTION public.tg_ff_snapshot_aprovacao();

-- Etapa 5: auditoria das alterações financeiras (somente mudanças confirmadas)
CREATE OR REPLACE FUNCTION public.tg_ff_auditar_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a jsonb := COALESCE(OLD.parametros->'financeiro','{}'); b jsonb := COALESCE(NEW.parametros->'financeiro','{}');
  k text; ant jsonb := '{}'; nov jsonb := '{}'; chaves text[] := '{}';
BEGIN
  IF a = b THEN RETURN NEW; END IF;
  FOR k IN SELECT DISTINCT x FROM (SELECT jsonb_object_keys(a) x UNION SELECT jsonb_object_keys(b)) s LOOP
    IF (a->k) IS DISTINCT FROM (b->k) THEN
      chaves := chaves || k; ant := ant || jsonb_build_object(k, a->k); nov := nov || jsonb_build_object(k, b->k);
    END IF;
  END LOOP;
  INSERT INTO audit_log(usuario_id, usuario_email, operacao, tabela, registro_id, valor_anterior, valor_novo, contexto)
  VALUES (auth.uid(), audit_actor_email(auth.uid()), 'update', 'folha_financeira_parametros', NEW.id::text, ant, nov,
          jsonb_build_object('parametros_alterados', chaves, 'origem', 'configuracao_municipal'));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ff_auditar_config() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_ff_auditar_config AFTER UPDATE OF parametros ON public.municipio_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_ff_auditar_config();

CREATE OR REPLACE FUNCTION public.tg_ff_auditar_nivel_cargo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.nivel IS DISTINCT FROM OLD.nivel THEN
    INSERT INTO audit_log(usuario_id, usuario_email, operacao, tabela, registro_id, valor_anterior, valor_novo, contexto)
    VALUES (auth.uid(), audit_actor_email(auth.uid()), 'update', 'folha_financeira_nivel_cargo', NEW.id::text,
      jsonb_build_object('nivel', OLD.nivel), jsonb_build_object('nivel', NEW.nivel),
      jsonb_build_object('cargo', NEW.nome, 'parametros_alterados', ARRAY['nivel_escolaridade']));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ff_auditar_nivel_cargo() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_ff_auditar_nivel_cargo AFTER UPDATE OF nivel ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.tg_ff_auditar_nivel_cargo();

-- Sincronização salarial transacional (tudo ou nada)
CREATE OR REPLACE FUNCTION public.ff_sincronizar_salarios(p_modo text, p_itens jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it jsonb; n int := 0; c int;
BEGIN
  IF NOT (is_master(auth.uid()) OR has_permission(auth.uid(), 'configuracao.editar', NULL, NULL)) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar salários';
  END IF;
  IF p_modo NOT IN ('vazios','todos') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    IF (it->>'valor')::numeric <= 0 THEN CONTINUE; END IF;
    UPDATE profissionais SET salario_base = (it->>'valor')::numeric
      WHERE cargo_id = (it->>'cargo_id')::uuid AND deleted_at IS NULL
        AND (p_modo = 'todos' OR salario_base IS NULL OR salario_base <= 0);
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  INSERT INTO audit_log(usuario_id, usuario_email, operacao, tabela, registro_id, valor_anterior, valor_novo, contexto)
  VALUES (auth.uid(), audit_actor_email(auth.uid()), 'custom', 'folha_financeira_sincronizacao', NULL, NULL,
    jsonb_build_object('profissionais_atualizados', n), jsonb_build_object('modo', p_modo, 'cargos', jsonb_array_length(p_itens)));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ff_sincronizar_salarios(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_sincronizar_salarios(text, jsonb) TO authenticated;