-- Ajuste do preset de permissões do perfil "Diretor de Unidade".
-- Escopo por unidade é aplicado automaticamente pelas RLS existentes
-- (user_has_unit + has_permission com _unidade_id).
DO $$
DECLARE
  v_perfil_id uuid;
  v_novos text[] := ARRAY[
    'pendencia.visualizar',
    'pendencia.responder',
    'pendencia.resolver',
    'pendencia.criar',
    'pendencia.reabrir',
    'pendencia.exportar',
    'pendencia.imprimir',
    'frequencia.analisar',
    'frequencia.aprovar',
    'frequencia.rejeitar',
    'frequencia.reabrir',
    'auditoria.visualizar'
  ];
  v_cod text;
  v_perm_id uuid;
BEGIN
  SELECT id INTO v_perfil_id FROM public.perfis WHERE codigo = 'DIRETOR_UNIDADE';
  IF v_perfil_id IS NULL THEN
    RAISE NOTICE 'Perfil DIRETOR_UNIDADE não encontrado — nada a fazer.';
    RETURN;
  END IF;

  FOREACH v_cod IN ARRAY v_novos LOOP
    SELECT id INTO v_perm_id FROM public.permissoes
      WHERE codigo = v_cod AND ativa = true AND deleted_at IS NULL;
    IF v_perm_id IS NULL THEN CONTINUE; END IF;

    INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
    VALUES (v_perfil_id, v_perm_id, true)
    ON CONFLICT (perfil_id, permissao_id)
    DO UPDATE SET concedida = true;
  END LOOP;
END $$;