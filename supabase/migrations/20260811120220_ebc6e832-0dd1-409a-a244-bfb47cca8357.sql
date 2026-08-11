-- Etapa 1: Adicionar colunas salariais
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS salario_base numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS salario_liquido numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS horas_extras numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS adicional_noturno numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS salario_bruto numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS gratificacao_incentivo numeric;
ALTER TABLE public.profissionais ADD COLUMN IF NOT EXISTS vencimento_liquido numeric;

-- Etapa 4: Criar a permissão nova (corrigido modulo e categoria)
INSERT INTO public.permissoes (codigo, nome, descricao, modulo, categoria)
VALUES ('profissional.dados_salariais', 'Visualizar dados salariais', 'Permite visualizar campos de salário e remuneração do profissional', 'profissional', 'visualizacao')
ON CONFLICT (codigo) DO NOTHING;

-- Garantir acesso a MASTER e GESTOR
DO $$
DECLARE
  v_perm_id uuid;
  v_role_id uuid;
BEGIN
  SELECT id INTO v_perm_id FROM public.permissoes WHERE codigo = 'profissional.dados_salariais';
  
  -- Master
  SELECT id INTO v_role_id FROM public.perfis WHERE nome ILIKE 'master' LIMIT 1;
  IF v_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
    VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
  END IF;

  -- Gestor
  SELECT id INTO v_role_id FROM public.perfis WHERE nome ILIKE 'gestor' LIMIT 1;
  IF v_role_id IS NOT NULL AND v_perm_id IS NOT NULL THEN
    INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
    VALUES (v_role_id, v_perm_id) ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Grants
GRANT SELECT, UPDATE, INSERT ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;
