DROP POLICY IF EXISTS "profissionais_select" ON public.profissionais;
CREATE POLICY "profissionais_select" ON public.profissionais
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    public.is_master(auth.uid()) OR 
    (
      (unidade_id IS NOT NULL AND public.user_has_unit(auth.uid(), unidade_id)) OR
      (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
    ) AND public.has_permission(auth.uid(), 'profissional.visualizar'::text)
  )
);

DROP POLICY IF EXISTS "pol_unidades_select" ON public.unidades;
CREATE POLICY "pol_unidades_select" ON public.unidades
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    public.is_master(auth.uid()) OR 
    public.user_has_unit(auth.uid(), id) OR 
    (secretaria_id IS NOT NULL AND public.user_has_secretaria(auth.uid(), secretaria_id))
  )
);