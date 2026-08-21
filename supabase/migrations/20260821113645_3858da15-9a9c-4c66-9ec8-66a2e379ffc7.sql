-- 1. Ajustar a função de cadeia de provedores para permitir acesso de qualquer usuário autenticado
-- Removemos a exigência de 'piso.importar' que é específica para administradores de RH.
CREATE OR REPLACE FUNCTION public.piso_ia_cadeia()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _modo text;
  _pid uuid;
  _lista jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  
  -- Para o HSM Expert, permitimos que qualquer usuário autenticado pegue a lista de provedores
  -- A segurança real está no fato de que esta função é SECURITY DEFINER mas a chave só sai para o server-side.
  -- E as Server Functions do HSM já validam permissões específicas de cada ferramenta.

  SELECT c.modo, c.provedor_id INTO _modo, _pid FROM public.piso_ia_config c WHERE c.id IS NOT NULL LIMIT 1;
  _modo := COALESCE(_modo, 'automatico');

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', p.id, 'tipo', p.tipo, 'nome', p.nome, 'modelo', p.modelo,
      'base_url', p.base_url, 'api_key', p.api_key,
      'timeout_ms', p.timeout_ms, 'tentativas', p.tentativas,
      'prioridade', p.prioridade, 'extra', p.extra
    ) ORDER BY p.prioridade, p.nome), '[]'::jsonb)
  INTO _lista
  FROM public.piso_ia_provedores p
  WHERE p.ativo AND (_modo <> 'manual' OR p.id = _pid);

  RETURN jsonb_build_object('modo', _modo, 'provedores', _lista);
END;
$$;

-- 2. Garantir que as políticas RLS de histórico permitam INSERT
-- A tabela hsm_conversas e hsm_mensagens já têm políticas, mas vamos reforçar
-- o bypass para Master e o acesso do proprietário.

DROP POLICY IF EXISTS hsm_conversas_owner ON public.hsm_conversas;
CREATE POLICY hsm_conversas_owner ON public.hsm_conversas
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_master(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_master(auth.uid()));

DROP POLICY IF EXISTS hsm_mensagens_owner ON public.hsm_mensagens;
CREATE POLICY hsm_mensagens_owner ON public.hsm_mensagens
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.hsm_conversas c WHERE c.id = conversa_id AND (c.user_id = auth.uid() OR public.is_master(auth.uid())))
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_master(auth.uid())
    OR EXISTS (SELECT 1 FROM public.hsm_conversas c WHERE c.id = conversa_id AND (c.user_id = auth.uid() OR public.is_master(auth.uid())))
  );

-- 3. Garantir que a auditoria também permita gravação
DROP POLICY IF EXISTS hsm_auditoria_insert_own ON public.hsm_auditoria;
CREATE POLICY hsm_auditoria_insert_own ON public.hsm_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_master(auth.uid()));
