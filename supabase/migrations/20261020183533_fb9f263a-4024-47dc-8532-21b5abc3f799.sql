ALTER TABLE public.folha_financeira_snapshots ADD COLUMN IF NOT EXISTS salarios jsonb;

CREATE OR REPLACE FUNCTION public.tg_ffs_imutavel() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Snapshots financeiros não podem ser excluídos'; END IF;
  IF NEW.parametros IS DISTINCT FROM OLD.parametros OR NEW.registro_id <> OLD.registro_id
     OR NEW.tipo <> OLD.tipo OR NEW.aprovado_em <> OLD.aprovado_em
     OR NEW.competencia_id IS DISTINCT FROM OLD.competencia_id
     OR NEW.unidade_id IS DISTINCT FROM OLD.unidade_id
     OR NEW.setor_id IS DISTINCT FROM OLD.setor_id
     OR NEW.aprovado_por IS DISTINCT FROM OLD.aprovado_por
     OR NEW.salarios IS DISTINCT FROM OLD.salarios
     OR NEW.created_at <> OLD.created_at
     OR (OLD.ativo = false AND (NEW.ativo = true OR NEW.substituido_em IS DISTINCT FROM OLD.substituido_em
         OR NEW.motivo_substituicao IS DISTINCT FROM OLD.motivo_substituicao)) THEN
    RAISE EXCEPTION 'Snapshot financeiro é imutável';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_ff_snapshot_aprovacao() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tipo text; v_comp uuid; v_uni uuid; v_setor uuid; v_por uuid; v_sal jsonb;
BEGIN
  IF NOT (NEW.status::text = 'aprovada' AND OLD.status::text IS DISTINCT FROM 'aprovada') THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'frequencias' THEN
    v_tipo := 'efetivos';
    SELECT cu.competencia_id, cu.unidade_id INTO v_comp, v_uni FROM competencia_unidades cu WHERE cu.id = NEW.competencia_unidade_id;
    v_setor := NEW.setor_id;
    SELECT jsonb_object_agg(p.id, jsonb_build_object('salario_base', p.salario_base, 'cargo_id', p.cargo_id, 'carga', c.carga_horaria_semanal))
      INTO v_sal FROM profissionais p LEFT JOIN cargos c ON c.id = p.cargo_id
      WHERE p.id IN (SELECT fp.profissional_id FROM frequencia_profissional fp WHERE fp.frequencia_id = NEW.id AND fp.deleted_at IS NULL);
  ELSE
    v_tipo := 'contratados'; v_comp := NEW.competencia_id; v_uni := NEW.unidade_id;
    SELECT jsonb_object_agg(p.id, jsonb_build_object('salario_base', p.salario_base, 'cargo_id', p.cargo_id, 'carga', c.carga_horaria_semanal))
      INTO v_sal FROM profissionais p LEFT JOIN cargos c ON c.id = p.cargo_id WHERE p.id = NEW.profissional_id;
  END IF;
  v_por := COALESCE(NEW.aprovada_por, auth.uid());
  UPDATE folha_financeira_snapshots SET ativo = false, substituido_em = now(), motivo_substituicao = 'reaprovacao'
    WHERE tipo = v_tipo AND registro_id = NEW.id AND ativo;
  INSERT INTO folha_financeira_snapshots(tipo, registro_id, competencia_id, unidade_id, setor_id, parametros, aprovado_por, salarios)
    VALUES (v_tipo, NEW.id, v_comp, v_uni, v_setor, ff_parametros_atuais(), v_por, COALESCE(v_sal, '{}'::jsonb));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tg_ff_snapshot_aprovacao() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ff_sincronizar_salarios(p_modo text, p_itens jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE it jsonb; n int := 0; c int; v numeric; cid uuid;
BEGIN
  IF NOT (is_master(auth.uid()) OR has_permission(auth.uid(), 'configuracao.editar', NULL, NULL)) THEN
    RAISE EXCEPTION 'Sem permissão para sincronizar salários';
  END IF;
  IF p_modo NOT IN ('vazios','todos') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
  IF jsonb_typeof(p_itens) <> 'array' THEN RAISE EXCEPTION 'Itens inválidos'; END IF;
  IF NOT pg_try_advisory_xact_lock(hashtext('ff_sincronizar_salarios')) THEN
    RAISE EXCEPTION 'Já existe uma sincronização em andamento';
  END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    BEGIN v := (it->>'valor')::numeric; cid := (it->>'cargo_id')::uuid;
    EXCEPTION WHEN others THEN RAISE EXCEPTION 'Valor ou cargo inválido na sincronização'; END;
    IF v IS NULL OR v <= 0 OR v > 1000000 THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM cargos WHERE id = cid AND deleted_at IS NULL) THEN RAISE EXCEPTION 'Cargo inexistente: %', cid; END IF;
    UPDATE profissionais SET salario_base = v
      WHERE cargo_id = cid AND deleted_at IS NULL
        AND (p_modo = 'todos' OR salario_base IS NULL OR salario_base <= 0)
        AND salario_base IS DISTINCT FROM v;
    GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  END LOOP;
  IF n > 0 THEN
    INSERT INTO audit_log(usuario_id, usuario_email, operacao, tabela, registro_id, valor_anterior, valor_novo, contexto)
    VALUES (auth.uid(), audit_actor_email(auth.uid()), 'custom', 'folha_financeira_sincronizacao', NULL, NULL,
      jsonb_build_object('profissionais_atualizados', n), jsonb_build_object('modo', p_modo, 'cargos', jsonb_array_length(p_itens), 'itens', p_itens));
  END IF;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ff_sincronizar_salarios(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ff_sincronizar_salarios(text, jsonb) TO authenticated;