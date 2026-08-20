-- FASE 9 & 10: CORREÇÃO DE RLS E GRANTS PARA DIRETOR_UNIDADE
-- Garante que get_minhas_unidades_ids seja resiliente e tenha permissões corretas.

-- 1. Assegurar que a função tem SECURITY DEFINER e search_path correto
CREATE OR REPLACE FUNCTION public.get_minhas_unidades_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT unidade_id 
    FROM public.usuario_unidades 
    WHERE usuario_id = auth.uid() 
      AND deleted_at IS NULL;
$function$;

-- 2. Grants de Execução
GRANT EXECUTE ON FUNCTION public.get_minhas_unidades_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;

-- 3. Grants de Leitura Críticos (Muitas vezes esquecidos em tabelas de auditoria ou metadados)
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.unidades TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.secretarias TO authenticated;
GRANT SELECT ON public.competencias TO authenticated;
GRANT SELECT ON public.competencia_unidades TO authenticated;
GRANT SELECT ON public.frequencias TO authenticated;
GRANT SELECT ON public.frequencia_profissional TO authenticated;
GRANT SELECT ON public.frequencias_contratados TO authenticated;
GRANT SELECT ON public.setores TO authenticated;

-- 4. Auditoria da Política de Frequências (Ajuste para garantir que Diretor veja sua unidade)
DROP POLICY IF EXISTS "frequencias_select_policy" ON public.frequencias;
CREATE POLICY "frequencias_select_policy" ON public.frequencias
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    EXISTS (
        SELECT 1 FROM public.competencia_unidades cu
        WHERE cu.id = frequencias.competencia_unidade_id
        AND cu.unidade_id IN (SELECT get_minhas_unidades_ids())
    )
);

-- 5. Auditoria da Política de Frequências Contratados (Tabela separada)
ALTER TABLE public.frequencias_contratados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "freq_contratados_select" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_select" ON public.frequencias_contratados
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR
    unidade_id IN (SELECT get_minhas_unidades_ids())
);

-- 6. Garantir que as tabelas de lookup (cargos, funcoes, vinculos) sejam legíveis
GRANT SELECT ON public.cargos TO authenticated;
GRANT SELECT ON public.funcoes TO authenticated;
GRANT SELECT ON public.vinculos TO authenticated;
GRANT SELECT ON public.tipos_unidade TO authenticated;

