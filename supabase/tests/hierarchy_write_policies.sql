-- Read-only regression checks: no records or access rules are changed.
SELECT 'Units allow authorized creation' AS rule,
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unidades'
    AND policyname = 'unidades_insert_authorized' AND cmd = 'INSERT'
    AND roles = ARRAY['authenticated']::name[]
    AND with_check LIKE '%is_master(auth.uid())%'
    AND with_check LIKE '%has_permission(auth.uid(), ''unidade.gerenciar''%') AS passed
UNION ALL
SELECT 'Units allow authorized editing',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'unidades'
    AND policyname = 'unidades_update_authorized' AND cmd = 'UPDATE'
    AND roles = ARRAY['authenticated']::name[]
    AND qual LIKE '%is_master(auth.uid())%'
    AND qual LIKE '%has_permission(auth.uid(), ''unidade.gerenciar''%'
    AND with_check = qual)
UNION ALL
SELECT 'Sectors preserve management permission and authorize Master',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'setores'
    AND policyname = 'pol_setores_write' AND cmd = 'ALL'
    AND roles = ARRAY['authenticated']::name[]
    AND qual LIKE '%is_master(auth.uid())%'
    AND qual LIKE '%has_permission(auth.uid(), ''unidade.gerenciar''%'
    AND with_check = qual);