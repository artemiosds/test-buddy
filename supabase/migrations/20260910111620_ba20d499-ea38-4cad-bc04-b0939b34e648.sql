GRANT SELECT, INSERT ON public.frequencia_historico TO authenticated;
GRANT ALL ON public.frequencia_historico TO service_role;
GRANT SELECT, INSERT ON public.frequencia_aprovacoes TO authenticated;
GRANT ALL ON public.frequencia_aprovacoes TO service_role;

DROP POLICY IF EXISTS "freq_hist_select" ON public.frequencia_historico;
CREATE POLICY "freq_hist_select" ON public.frequencia_historico
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "freq_hist_insert" ON public.frequencia_historico;
CREATE POLICY "freq_hist_insert" ON public.frequencia_historico
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (executado_por IS NULL OR executado_por = auth.uid()));

DROP TRIGGER IF EXISTS trg_frequencias_audit ON public.frequencias;
CREATE TRIGGER trg_frequencias_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.frequencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();

DROP TRIGGER IF EXISTS trg_competencias_audit ON public.competencias;
CREATE TRIGGER trg_competencias_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.competencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_row();