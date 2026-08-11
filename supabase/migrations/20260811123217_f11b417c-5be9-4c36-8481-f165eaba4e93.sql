INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT 
    (SELECT id FROM public.perfis WHERE codigo = 'MASTER' LIMIT 1),
    (SELECT id FROM public.permissoes WHERE codigo = 'profissional.dados_salariais' LIMIT 1)
ON CONFLICT DO NOTHING;
