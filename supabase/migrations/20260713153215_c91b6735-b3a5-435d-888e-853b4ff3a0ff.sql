
-- Remove permissões de análise/aprovação/rejeição do perfil DIRETOR_UNIDADE.
-- Diretor apenas cria, edita, envia (e reencaminha após devolução).
DELETE FROM public.perfil_permissoes pp
USING public.perfis p, public.permissoes pm
WHERE pp.perfil_id = p.id
  AND pp.permissao_id = pm.id
  AND p.codigo = 'DIRETOR_UNIDADE'
  AND pm.codigo IN (
    'frequencia.analisar',
    'frequencia.aprovar',
    'frequencia.rejeitar',
    'frequencia.arquivar'
  );

-- Revoga eventuais concessões individuais destas permissões para usuários com perfil DIRETOR_UNIDADE
UPDATE public.usuario_permissoes up
SET tipo = 'revogada', updated_at = now()
FROM public.usuarios u, public.perfis p, public.permissoes pm
WHERE up.usuario_id = u.id
  AND u.perfil_id = p.id
  AND up.permissao_id = pm.id
  AND p.codigo = 'DIRETOR_UNIDADE'
  AND pm.codigo IN ('frequencia.analisar','frequencia.aprovar','frequencia.rejeitar','frequencia.arquivar')
  AND up.tipo = 'concedida'
  AND up.deleted_at IS NULL;
