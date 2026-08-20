-- FASE 9 & 10: CORREÇÃO DEFINITIVA DE RLS E GRANTS PARA DIRETOR_UNIDADE
-- Esta migração resolve a visibilidade de dados para o perfil DIRETOR_UNIDADE,
-- garantindo que as funções de contexto e as políticas de RLS funcionem corretamente.

-- 1. Garantir que get_minhas_unidades_ids seja SECURITY DEFINER e use search_path public
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

-- 2. Grants de execução para funções de contexto
GRANT EXECUTE ON FUNCTION public.get_minhas_unidades_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;

-- 3. Grants de leitura em tabelas core para usuários autenticados
-- Sem SELECT nas tabelas, o RLS falha ao tentar consultar os vínculos.
GRANT SELECT ON public.usuarios TO authenticated;
GRANT SELECT ON public.perfis TO authenticated;
GRANT SELECT ON public.unidades TO authenticated;
GRANT SELECT ON public.usuario_unidades TO authenticated;
GRANT SELECT ON public.secretarias TO authenticated;
GRANT SELECT ON public.competencias TO authenticated;
GRANT SELECT ON public.competencia_unidades TO authenticated;
GRANT SELECT ON public.frequencias TO authenticated;
GRANT SELECT ON public.frequencia_profissional TO authenticated;
GRANT SELECT ON public.frequencias_contratados TO authenticated;
GRANT SELECT ON public.profissionais TO authenticated;
GRANT SELECT ON public.setores TO authenticated;
GRANT SELECT ON public.cargos TO authenticated;
GRANT SELECT ON public.funcoes TO authenticated;
GRANT SELECT ON public.vinculos TO authenticated;

-- 4. Ajuste na política de Frequências (Tabela Mestre)
-- Garante que o Diretor veja as frequências vinculadas às suas unidades via competencia_unidades
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

-- 5. Política para Frequências de Contratados
-- A tabela frequencias_contratados possui unidade_id direto.
ALTER TABLE public.frequencias_contratados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "freq_contratados_select" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_select" ON public.frequencias_contratados
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR
    unidade_id IN (SELECT get_minhas_unidades_ids())
);

-- 6. Política para Frequência Profissional (Efetivos)
-- Depende da tabela frequencias pai.
ALTER TABLE public.frequencia_profissional ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "freq_prof_select" ON public.frequencia_profissional;
CREATE POLICY "freq_prof_select" ON public.frequencia_profissional
FOR SELECT TO authenticated
USING (
    is_master(auth.uid())
    OR
    EXISTS (
        SELECT 1 FROM public.frequencias f
        JOIN public.competencia_unidades cu ON cu.id = f.competencia_unidade_id
        WHERE f.id = frequencia_profissional.frequencia_id
        AND cu.unidade_id IN (SELECT get_minhas_unidades_ids())
    )
);

-- 7. Política para Profissionais
DROP POLICY IF EXISTS "profissionais_select_policy" ON public.profissionais;
CREATE POLICY "profissionais_select_policy" ON public.profissionais
FOR SELECT TO authenticated 
USING (
    is_master(auth.uid()) 
    OR 
    unidade_id IN (SELECT get_minhas_unidades_ids())
    OR
    secretaria_id IN (SELECT secretaria_id FROM public.usuario_secretarias WHERE usuario_id = auth.uid() AND deleted_at IS NULL)
);
