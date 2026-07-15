DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;
CREATE POLICY "audit_log_insert" ON public.audit_log
FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid() OR usuario_id IS NULL);