-- 1) Bloqueio efetivo: status/deleted_at passam a valer antes de qualquer privilégio
CREATE OR REPLACE FUNCTION public.is_master(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    is_master_bool boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        LEFT JOIN public.perfis p ON p.id = u.perfil_id
        WHERE u.id = _user_id
          AND u.deleted_at IS NULL
          AND u.status = 'ativo'
          AND (
            u.acesso_todas_unidades = true
            OR u.acesso_todas_secretarias = true
            OR p.codigo IN ('MASTER', 'ADMINISTRADOR_MASTER', 'ADMIN_SMS', 'ADMIN_MASTER', 'SUPERMASTER')
          )
    ) INTO is_master_bool;

    RETURN COALESCE(is_master_bool, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_permission_core(_user_id uuid, _codigo text, _unidade_id uuid DEFAULT NULL::uuid, _secretaria_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _perm_id UUID;
  _perfil_id UUID;
  _revogada BOOLEAN;
  _concedida_individual BOOLEAN;
  _usuario_ativo BOOLEAN;
  _concedida_perfil BOOLEAN;
BEGIN
  -- Validação de conta ANTES de qualquer privilégio (bloqueado/inativo/removido = sem acesso)
  SELECT (deleted_at IS NULL AND status = 'ativo'), perfil_id
    INTO _usuario_ativo, _perfil_id
  FROM public.usuarios WHERE id = _user_id;

  IF _usuario_ativo IS NOT TRUE THEN
    RETURN false;
  END IF;

  IF public.is_master_db(_user_id) THEN
    RETURN true;
  END IF;

  SELECT id INTO _perm_id
  FROM public.permissoes
  WHERE codigo = _codigo AND ativa = true AND deleted_at IS NULL;

  IF _perm_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'revogada' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _revogada;

  IF _revogada THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.usuario_permissoes
    WHERE usuario_id = _user_id AND permissao_id = _perm_id
      AND tipo = 'concedida' AND deleted_at IS NULL
      AND valido_de <= now() AND (valido_ate IS NULL OR valido_ate > now())
      AND (unidade_id IS NULL OR unidade_id = _unidade_id)
      AND (secretaria_id IS NULL OR secretaria_id = _secretaria_id)
  ) INTO _concedida_individual;

  IF _concedida_individual THEN
    RETURN true;
  END IF;

  IF _perfil_id IS NOT NULL THEN
    IF _unidade_id IS NOT NULL THEN
      SELECT concedida INTO _concedida_perfil
        FROM public.perfil_permissoes_unidade
       WHERE perfil_id = _perfil_id
         AND permissao_id = _perm_id
         AND unidade_id = _unidade_id;

      IF _concedida_perfil IS NOT NULL THEN
        RETURN _concedida_perfil;
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.perfil_permissoes
      WHERE perfil_id = _perfil_id AND permissao_id = _perm_id
    ) INTO _concedida_perfil;

    IF _concedida_perfil THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END $function$;

-- 2) Exclusão completa de usuário com retorno JSON tratado
CREATE OR REPLACE FUNCTION public.excluir_usuario_completo(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_nome text;
BEGIN
  IF v_caller IS NULL OR NOT public.is_master(v_caller) THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Apenas usuário MASTER pode excluir usuários.', 'id', p_user_id);
  END IF;

  IF p_user_id = v_caller THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Você não pode excluir a própria conta.', 'id', p_user_id);
  END IF;

  SELECT nome_completo INTO v_nome FROM public.usuarios WHERE id = p_user_id;
  IF v_nome IS NULL THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Usuário não encontrado.', 'id', p_user_id);
  END IF;

  -- Vínculos que podem ser removidos
  DELETE FROM public.usuario_unidades WHERE usuario_id = p_user_id;
  DELETE FROM public.usuario_secretarias WHERE usuario_id = p_user_id;
  DELETE FROM public.usuario_permissoes WHERE usuario_id = p_user_id;
  DELETE FROM public.notificacoes WHERE usuario_id = p_user_id;

  -- Histórico: desvincula o autor preservando os registros
  UPDATE public.frequencia_aprovacoes SET executado_por = NULL WHERE executado_por = p_user_id;
  UPDATE public.frequencia_pendencias SET aberta_por = NULL WHERE aberta_por = p_user_id;
  UPDATE public.frequencia_pendencias SET respondida_por = NULL WHERE respondida_por = p_user_id;
  UPDATE public.frequencia_pendencias SET resolvida_por = NULL WHERE resolvida_por = p_user_id;
  UPDATE public.frequencia_profissional SET aprovada_por = NULL WHERE aprovada_por = p_user_id;
  UPDATE public.frequencia_profissional SET analisado_por = NULL WHERE analisado_por = p_user_id;
  UPDATE public.frequencias SET enviada_por = NULL WHERE enviada_por = p_user_id;
  UPDATE public.frequencias SET aprovada_por = NULL WHERE aprovada_por = p_user_id;
  UPDATE public.pendencia_historico SET autor_id = NULL WHERE autor_id = p_user_id;
  UPDATE public.pendencias SET created_by = NULL WHERE created_by = p_user_id;
  UPDATE public.pendencias SET updated_by = NULL WHERE updated_by = p_user_id;
  UPDATE public.pendencias SET deleted_by = NULL WHERE deleted_by = p_user_id;
  UPDATE public.pendencias SET responsavel_id = NULL WHERE responsavel_id = p_user_id;
  UPDATE public.competencia_unidades SET responsavel_id = NULL WHERE responsavel_id = p_user_id;
  DELETE FROM public.assinaturas_institucionais WHERE usuario_id = p_user_id;

  DELETE FROM public.usuarios WHERE id = p_user_id;

  RETURN jsonb_build_object('sucesso', true, 'mensagem', 'Usuário ' || v_nome || ' excluído com sucesso.', 'id', p_user_id);
EXCEPTION
  WHEN foreign_key_violation THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Não foi possível excluir: o usuário possui registros vinculados obrigatórios. Considere bloqueá-lo em vez de excluir.', 'id', p_user_id);
  WHEN others THEN
    RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Falha ao excluir usuário: ' || SQLERRM, 'id', p_user_id);
END $function$;

REVOKE ALL ON FUNCTION public.excluir_usuario_completo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.excluir_usuario_completo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.excluir_usuario_completo(uuid) TO service_role;