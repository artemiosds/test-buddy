-- Correção Final de RLS para Diretores de Unidade (Frequências e Profissionais)
-- Data: 2026-08-19

-- 1. Tabela FREQUENCIAS
DROP POLICY IF EXISTS "frequencias_select_v2" ON public.frequencias;
CREATE POLICY "frequencias_select_v2" ON public.frequencias
FOR SELECT
TO public
USING (
  deleted_at IS NULL
  AND (
    is_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM competencia_unidades cu
      WHERE cu.id = frequencias.competencia_unidade_id
      AND user_has_unit(auth.uid(), cu.unidade_id)
    )
    OR EXISTS (
      SELECT 1 FROM competencia_unidades cu
      JOIN unidades u ON u.id = cu.unidade_id
      WHERE cu.id = frequencias.competencia_unidade_id
      AND u.secretaria_id IS NOT NULL 
      AND user_has_secretaria(auth.uid(), u.secretaria_id)
    )
  )
);

-- 2. Tabela FREQUENCIA_PROFISSIONAL
DROP POLICY IF EXISTS "freq_prof_select" ON public.frequencia_profissional;
CREATE POLICY "freq_prof_select" ON public.frequencia_profissional
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    is_master(auth.uid())
    OR EXISTS (
      SELECT 1 FROM frequencias f
      JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
      WHERE f.id = frequencia_profissional.frequencia_id
      AND user_has_unit(auth.uid(), cu.unidade_id)
    )
    OR EXISTS (
      SELECT 1 FROM frequencias f
      JOIN competencia_unidades cu ON cu.id = f.competencia_unidade_id
      JOIN unidades u ON u.id = cu.unidade_id
      WHERE f.id = frequencia_profissional.frequencia_id
      AND u.secretaria_id IS NOT NULL 
      AND user_has_secretaria(auth.uid(), u.secretaria_id)
    )
  )
);

-- 3. Tabela FREQUENCIAS_CONTRATADOS
DROP POLICY IF EXISTS "freq_contratados_select" ON public.frequencias_contratados;
CREATE POLICY "freq_contratados_select" ON public.frequencias_contratados
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    is_master(auth.uid())
    OR user_has_unit(auth.uid(), unidade_id)
    OR EXISTS (
       SELECT 1 FROM unidades u 
       WHERE u.id = frequencias_contratados.unidade_id 
       AND u.secretaria_id IS NOT NULL 
       AND user_has_secretaria(auth.uid(), u.secretaria_id)
    )
  )
);

-- 4. Tabela PROFISSIONAIS (Garantindo que o Diretor veja quem deve ser listado na folha)
DROP POLICY IF EXISTS "profissionais_select" ON public.profissionais;
CREATE POLICY "profissionais_select" ON public.profissionais
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    is_master(auth.uid())
    OR user_has_unit(auth.uid(), unidade_id)
    OR (secretaria_id IS NOT NULL AND user_has_secretaria(auth.uid(), secretaria_id))
  )
);
