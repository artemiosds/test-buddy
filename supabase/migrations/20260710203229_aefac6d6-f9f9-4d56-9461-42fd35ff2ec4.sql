
-- 1) Seed inicial de Cargos e Funções (só se ainda estiver vazio)
INSERT INTO public.cargos (nome, codigo, cbo, nivel, grupo_ocupacional, carga_horaria_semanal, status)
SELECT * FROM (VALUES
  ('Médico Clínico', 'MED-CLI', '225125', 'superior'::public.nivel_cargo, 'Saúde', 20, 'ativa'::public.status_entidade),
  ('Enfermeiro', 'ENF', '223505', 'superior'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Técnico de Enfermagem', 'TEC-ENF', '322205', 'tecnico'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Auxiliar de Enfermagem', 'AUX-ENF', '322230', 'medio'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Odontólogo', 'ODO', '223208', 'superior'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Auxiliar de Saúde Bucal', 'ASB', '322415', 'medio'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Fisioterapeuta', 'FISIO', '223605', 'superior'::public.nivel_cargo, 'Saúde', 30, 'ativa'::public.status_entidade),
  ('Psicólogo', 'PSI', '251510', 'superior'::public.nivel_cargo, 'Saúde', 30, 'ativa'::public.status_entidade),
  ('Assistente Social', 'AS', '251605', 'superior'::public.nivel_cargo, 'Social', 30, 'ativa'::public.status_entidade),
  ('Farmacêutico', 'FARM', '223405', 'superior'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Nutricionista', 'NUT', '223710', 'superior'::public.nivel_cargo, 'Saúde', 30, 'ativa'::public.status_entidade),
  ('Fonoaudiólogo', 'FONO', '223810', 'superior'::public.nivel_cargo, 'Saúde', 30, 'ativa'::public.status_entidade),
  ('Terapeuta Ocupacional', 'TO', '223905', 'superior'::public.nivel_cargo, 'Saúde', 30, 'ativa'::public.status_entidade),
  ('Agente Comunitário de Saúde', 'ACS', '515105', 'medio'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Agente de Endemias', 'ACE', '515140', 'medio'::public.nivel_cargo, 'Saúde', 40, 'ativa'::public.status_entidade),
  ('Auxiliar Administrativo', 'AUX-ADM', '411010', 'medio'::public.nivel_cargo, 'Administrativo', 40, 'ativa'::public.status_entidade),
  ('Recepcionista', 'REC', '422105', 'medio'::public.nivel_cargo, 'Administrativo', 40, 'ativa'::public.status_entidade),
  ('Motorista', 'MOT', '782310', 'fundamental'::public.nivel_cargo, 'Operacional', 40, 'ativa'::public.status_entidade),
  ('Auxiliar de Serviços Gerais', 'ASG', '514320', 'fundamental'::public.nivel_cargo, 'Operacional', 40, 'ativa'::public.status_entidade),
  ('Vigilante', 'VIG', '517330', 'fundamental'::public.nivel_cargo, 'Operacional', 40, 'ativa'::public.status_entidade)
) AS v(nome, codigo, cbo, nivel, grupo_ocupacional, carga_horaria_semanal, status)
WHERE NOT EXISTS (SELECT 1 FROM public.cargos WHERE deleted_at IS NULL);

INSERT INTO public.funcoes (nome, codigo, gratificacao_percentual, status)
SELECT * FROM (VALUES
  ('Sem Função Gratificada', 'SEM', NULL::numeric, 'ativa'::public.status_entidade),
  ('Coordenador de Unidade', 'COORD-UN', 40, 'ativa'::public.status_entidade),
  ('Coordenador de Área', 'COORD-AREA', 50, 'ativa'::public.status_entidade),
  ('Diretor de Unidade', 'DIR-UN', 60, 'ativa'::public.status_entidade),
  ('Diretor de Departamento', 'DIR-DEP', 80, 'ativa'::public.status_entidade),
  ('Chefe de Setor', 'CHEFE-SET', 30, 'ativa'::public.status_entidade),
  ('Responsável Técnico', 'RT', 25, 'ativa'::public.status_entidade),
  ('Preceptor', 'PRECEP', 20, 'ativa'::public.status_entidade),
  ('Supervisor de Equipe', 'SUP-EQ', 30, 'ativa'::public.status_entidade),
  ('Assessor Técnico', 'ASSES', 40, 'ativa'::public.status_entidade)
) AS v(nome, codigo, gratificacao_percentual, status)
WHERE NOT EXISTS (SELECT 1 FROM public.funcoes WHERE deleted_at IS NULL);

-- 2) Trigger que garante que apenas Masters podem alterar as flags de acesso total,
--    e que sincroniza as flags quando o perfil MASTER é atribuído/removido.
CREATE OR REPLACE FUNCTION public.tg_usuarios_master_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _uid UUID := auth.uid();
  _master_perfil_id UUID;
  _old_perfil_codigo TEXT;
  _new_perfil_codigo TEXT;
BEGIN
  SELECT id INTO _master_perfil_id FROM public.perfis WHERE codigo = 'MASTER' LIMIT 1;

  IF TG_OP = 'UPDATE' AND OLD.perfil_id IS NOT NULL THEN
    SELECT codigo INTO _old_perfil_codigo FROM public.perfis WHERE id = OLD.perfil_id;
  END IF;
  IF NEW.perfil_id IS NOT NULL THEN
    SELECT codigo INTO _new_perfil_codigo FROM public.perfis WHERE id = NEW.perfil_id;
  END IF;

  -- Se estão trocando o perfil, sincroniza as flags de acesso total.
  IF TG_OP = 'UPDATE' AND NEW.perfil_id IS DISTINCT FROM OLD.perfil_id THEN
    IF _new_perfil_codigo = 'MASTER' THEN
      NEW.acesso_todas_unidades := true;
      NEW.acesso_todas_secretarias := true;
    ELSIF _old_perfil_codigo = 'MASTER' THEN
      NEW.acesso_todas_unidades := false;
      NEW.acesso_todas_secretarias := false;
    END IF;
  END IF;

  -- Bloqueia alteração direta das flags por quem não é master.
  IF TG_OP = 'UPDATE' AND _uid IS NOT NULL AND NOT public.is_master(_uid) THEN
    IF NEW.acesso_todas_unidades IS DISTINCT FROM OLD.acesso_todas_unidades
       OR NEW.acesso_todas_secretarias IS DISTINCT FROM OLD.acesso_todas_secretarias THEN
      RAISE EXCEPTION 'Somente usuários Master podem conceder ou remover acesso total (unidades/secretarias).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Registra em auditoria concessão/remoção de master.
  IF TG_OP = 'UPDATE' AND (
       NEW.acesso_todas_unidades IS DISTINCT FROM OLD.acesso_todas_unidades
    OR NEW.acesso_todas_secretarias IS DISTINCT FROM OLD.acesso_todas_secretarias
  ) THEN
    INSERT INTO public.audit_log (usuario_id, operacao, tabela, registro_id, valor_anterior, valor_novo)
    VALUES (
      _uid, 'update'::public.operacao_auditoria, 'public.usuarios', NEW.id::TEXT,
      jsonb_build_object(
        'acesso_todas_unidades', OLD.acesso_todas_unidades,
        'acesso_todas_secretarias', OLD.acesso_todas_secretarias,
        'perfil_id', OLD.perfil_id
      ),
      jsonb_build_object(
        'acesso_todas_unidades', NEW.acesso_todas_unidades,
        'acesso_todas_secretarias', NEW.acesso_todas_secretarias,
        'perfil_id', NEW.perfil_id,
        'motivo', 'alteracao_master'
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_usuarios_master_guard ON public.usuarios;
CREATE TRIGGER trg_usuarios_master_guard
BEFORE UPDATE ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.tg_usuarios_master_guard();
