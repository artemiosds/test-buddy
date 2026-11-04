CREATE OR REPLACE FUNCTION public.reabrir_folha_aprovada(_frequencia_id uuid, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  _uid uuid := auth.uid();
  _f record;
  _perfil text;
  _nome text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado' USING ERRCODE='42501'; END IF;
  SELECT p.codigo, u.nome_completo INTO _perfil, _nome FROM usuarios u LEFT JOIN perfis p ON p.id = u.perfil_id WHERE u.id = _uid;
  IF NOT (public.is_master(_uid) OR coalesce(_perfil,'') IN ('GESTOR','MASTER','ADMINISTRADOR_MASTER','ADMIN_SMS')) THEN
    RAISE EXCEPTION 'Somente Master ou Gestor podem reabrir folhas aprovadas' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(_motivo,''))) < 10 THEN
    RAISE EXCEPTION 'Informe um motivo com pelo menos 10 caracteres';
  END IF;

  SELECT f.id, f.tipo, f.status, f.setor_id, cu.competencia_id, cu.unidade_id INTO _f
  FROM frequencias f JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
  WHERE f.id = _frequencia_id FOR UPDATE OF f;
  IF NOT FOUND THEN RAISE EXCEPTION 'Folha não encontrada'; END IF;
  IF _f.status <> 'aprovada' THEN RAISE EXCEPTION 'Apenas folhas aprovadas podem ser reabertas'; END IF;

  UPDATE frequencias SET status='em_analise', aprovada_por=NULL, data_aprovacao=NULL, updated_by=_uid
  WHERE id = _frequencia_id;

  IF _f.tipo = 'efetivos' THEN
    UPDATE frequencia_profissional SET status_linha='pendente', aprovada_em=NULL, aprovada_por=NULL
    WHERE frequencia_id = _frequencia_id AND status_linha='aprovada';
  ELSE
    UPDATE frequencias_contratados fc SET status='em_analise', aprovada_em=NULL, aprovada_por=NULL
    WHERE fc.competencia_id=_f.competencia_id AND fc.unidade_id=_f.unidade_id AND fc.status='aprovada'
      AND (_f.setor_id IS NULL OR EXISTS (SELECT 1 FROM profissionais p WHERE p.id=fc.profissional_id AND p.setor_id=_f.setor_id));
  END IF;

  INSERT INTO frequencia_historico(frequencia_id,status_anterior,status_novo,acao,justificativa,executado_por,executado_nome,executado_perfil)
  VALUES (_frequencia_id,'aprovada','em_analise','Reabertura para retificação',trim(_motivo),_uid,coalesce(_nome,'Usuário'),coalesce(_perfil,'MASTER'));
END $$;
REVOKE ALL ON FUNCTION public.reabrir_folha_aprovada(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reabrir_folha_aprovada(uuid,text) TO authenticated;