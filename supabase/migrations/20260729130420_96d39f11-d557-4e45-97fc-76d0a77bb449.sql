CREATE TABLE public.hsm_config (
  id boolean PRIMARY KEY DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  somente_leitura boolean NOT NULL DEFAULT false,
  prompt_sistema text NOT NULL DEFAULT 'Você é o HSM Expert, especialista inteligente em Gestão da Saúde da Secretaria Municipal de Saúde, integrado ao ERP. Fale sempre em português do Brasil, com tom corporativo, objetivo e cordial. Nunca invente dados: se a informação não veio de uma ferramenta do sistema, diga que precisa consultar ou que não há registro.',
  modo_execucao text NOT NULL DEFAULT 'assistido',
  ferramentas_habilitadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  agentes_habilitados jsonb NOT NULL DEFAULT '[]'::jsonb,
  limites jsonb NOT NULL DEFAULT '{"mensagens_por_minuto":12,"mensagens_por_dia":300,"ferramentas_por_mensagem":3,"tempo_maximo_ms":120000}'::jsonb,
  cache_config jsonb NOT NULL DEFAULT '{"habilitado":true,"ttl_segundos":300}'::jsonb,
  retencao_config jsonb NOT NULL DEFAULT '{"mensagens_dias":365,"auditoria_dias":1825}'::jsonb,
  observabilidade_config jsonb NOT NULL DEFAULT '{"registrar_tentativas":true,"registrar_ferramentas":true,"registrar_erros":true}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT hsm_config_singleton CHECK (id),
  CONSTRAINT hsm_config_modo_execucao_check CHECK (modo_execucao IN ('assistido', 'somente_consulta', 'manutencao')),
  CONSTRAINT hsm_config_ferramentas_array_check CHECK (jsonb_typeof(ferramentas_habilitadas) = 'array'),
  CONSTRAINT hsm_config_agentes_array_check CHECK (jsonb_typeof(agentes_habilitados) = 'array'),
  CONSTRAINT hsm_config_limites_object_check CHECK (jsonb_typeof(limites) = 'object'),
  CONSTRAINT hsm_config_cache_object_check CHECK (jsonb_typeof(cache_config) = 'object'),
  CONSTRAINT hsm_config_retencao_object_check CHECK (jsonb_typeof(retencao_config) = 'object'),
  CONSTRAINT hsm_config_observabilidade_object_check CHECK (jsonb_typeof(observabilidade_config) = 'object'),
  CONSTRAINT hsm_config_metadata_object_check CHECK (jsonb_typeof(metadata) = 'object')
);

GRANT SELECT, UPDATE ON public.hsm_config TO authenticated;
GRANT ALL ON public.hsm_config TO service_role;

ALTER TABLE public.hsm_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hsm_config_admin_select"
ON public.hsm_config
FOR SELECT
TO authenticated
USING (
  public.is_master(auth.uid())
  OR public.has_permission(auth.uid(), 'sistema.configurar', NULL::uuid, NULL::uuid)
  OR public.has_permission(auth.uid(), 'configuracao.editar', NULL::uuid, NULL::uuid)
);

CREATE POLICY "hsm_config_admin_update"
ON public.hsm_config
FOR UPDATE
TO authenticated
USING (
  public.is_master(auth.uid())
  OR public.has_permission(auth.uid(), 'sistema.configurar', NULL::uuid, NULL::uuid)
  OR public.has_permission(auth.uid(), 'configuracao.editar', NULL::uuid, NULL::uuid)
)
WITH CHECK (
  id = true
  AND (
    public.is_master(auth.uid())
    OR public.has_permission(auth.uid(), 'sistema.configurar', NULL::uuid, NULL::uuid)
    OR public.has_permission(auth.uid(), 'configuracao.editar', NULL::uuid, NULL::uuid)
  )
);

CREATE TRIGGER tg_hsm_config_updated_at
BEFORE UPDATE ON public.hsm_config
FOR EACH ROW
EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.hsm_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hsm_config_ler()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ativo', ativo,
    'somente_leitura', somente_leitura,
    'prompt_sistema', prompt_sistema,
    'modo_execucao', modo_execucao,
    'ferramentas_habilitadas', ferramentas_habilitadas,
    'agentes_habilitados', agentes_habilitados,
    'limites', limites,
    'cache_config', cache_config,
    'retencao_config', retencao_config,
    'observabilidade_config', observabilidade_config,
    'metadata', metadata,
    'updated_at', updated_at
  )
  FROM public.hsm_config
  WHERE id = true;
$$;

GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hsm_config_ler() TO service_role;