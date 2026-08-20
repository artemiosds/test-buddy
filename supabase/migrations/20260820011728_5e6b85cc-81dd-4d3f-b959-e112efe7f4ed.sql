GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias_contratados TO authenticated;
GRANT ALL ON public.frequencias_contratados TO service_role;

DROP POLICY IF EXISTS frequencias_contratados_insert ON public.frequencias_contratados;
CREATE POLICY frequencias_contratados_insert
ON public.frequencias_contratados FOR INSERT TO authenticated
WITH CHECK (
  public.is_master(auth.uid())
  OR unidade_id IN (SELECT public.get_minhas_unidades_ids())
);

DROP POLICY IF EXISTS frequencias_contratados_update ON public.frequencias_contratados;
CREATE POLICY frequencias_contratados_update
ON public.frequencias_contratados FOR UPDATE TO authenticated
USING (
  public.is_master(auth.uid())
  OR unidade_id IN (SELECT public.get_minhas_unidades_ids())
)
WITH CHECK (
  public.is_master(auth.uid())
  OR unidade_id IN (SELECT public.get_minhas_unidades_ids())
);

DROP POLICY IF EXISTS frequencias_contratados_delete ON public.frequencias_contratados;
CREATE POLICY frequencias_contratados_delete
ON public.frequencias_contratados FOR DELETE TO authenticated
USING (
  public.is_master(auth.uid())
  OR unidade_id IN (SELECT public.get_minhas_unidades_ids())
);