
-- =====================================================================
-- MIGRATION 02.05 — POLÍTICAS RLS DEFINITIVAS
-- =====================================================================

-- ---------------------------------------------------------------------
-- LIMPEZA das políticas temporárias
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "auth_read_all" ON public.secretarias;
DROP POLICY IF EXISTS "auth_read_all" ON public.municipio_config;
DROP POLICY IF EXISTS "auth_read_all" ON public.unidades;
DROP POLICY IF EXISTS "auth_read_all" ON public.setores;
DROP POLICY IF EXISTS "auth_read_all" ON public.fundos;
DROP POLICY IF EXISTS "auth_read_all" ON public.cargos;
DROP POLICY IF EXISTS "auth_read_all" ON public.funcoes;
DROP POLICY IF EXISTS "auth_read_all" ON public.vinculos;
DROP POLICY IF EXISTS "auth_read_all" ON public.calendario_institucional;
DROP POLICY IF EXISTS "usuario_ve_proprio" ON public.usuarios;
DROP POLICY IF EXISTS "auth_read_perfis" ON public.perfis;
DROP POLICY IF EXISTS "auth_read_permissoes" ON public.permissoes;
DROP POLICY IF EXISTS "auth_read_perfil_permissoes" ON public.perfil_permissoes;
DROP POLICY IF EXISTS "usuario_ve_proprias_permissoes" ON public.usuario_permissoes;
DROP POLICY IF EXISTS "usuario_ve_proprias_unidades" ON public.usuario_unidades;
DROP POLICY IF EXISTS "usuario_ve_proprias_secretarias" ON public.usuario_secretarias;

-- ---------------------------------------------------------------------
-- FUNDAÇÃO — LEITURA para autenticados
-- ---------------------------------------------------------------------
CREATE POLICY "pol_secretarias_select" ON public.secretarias FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR public.user_has_secretaria(auth.uid(), id)));

CREATE POLICY "pol_municipio_config_select" ON public.municipio_config FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY "pol_unidades_select" ON public.unidades FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), id) OR public.user_has_secretaria(auth.uid(), secretaria_id)));

CREATE POLICY "pol_setores_select" ON public.setores FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_master(auth.uid()) OR public.user_has_unit(auth.uid(), unidade_id)));

CREATE POLICY "pol_fundos_select" ON public.fundos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_cargos_select" ON public.cargos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_funcoes_select" ON public.funcoes FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_vinculos_select" ON public.vinculos FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_calendario_select" ON public.calendario_institucional FOR SELECT TO authenticated USING (deleted_at IS NULL);

-- FUNDAÇÃO — ESCRITA restrita
CREATE POLICY "pol_secretarias_write" ON public.secretarias FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'secretaria.gerenciar')) WITH CHECK (public.has_permission(auth.uid(), 'secretaria.gerenciar'));

CREATE POLICY "pol_municipio_config_write" ON public.municipio_config FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

CREATE POLICY "pol_unidades_write" ON public.unidades FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'unidade.gerenciar', id, secretaria_id))
  WITH CHECK (public.has_permission(auth.uid(), 'unidade.gerenciar', id, secretaria_id));

CREATE POLICY "pol_setores_write" ON public.setores FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'unidade.gerenciar', unidade_id))
  WITH CHECK (public.has_permission(auth.uid(), 'unidade.gerenciar', unidade_id));

CREATE POLICY "pol_fundos_write" ON public.fundos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

CREATE POLICY "pol_cargos_write" ON public.cargos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

CREATE POLICY "pol_funcoes_write" ON public.funcoes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

CREATE POLICY "pol_vinculos_write" ON public.vinculos FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

CREATE POLICY "pol_calendario_write" ON public.calendario_institucional FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'configuracao.editar')) WITH CHECK (public.has_permission(auth.uid(), 'configuracao.editar'));

-- ---------------------------------------------------------------------
-- USUÁRIOS
-- ---------------------------------------------------------------------
CREATE POLICY "pol_usuarios_select" ON public.usuarios FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_permission(auth.uid(), 'usuario.gerenciar'));

CREATE POLICY "pol_usuarios_update_proprio" ON public.usuarios FOR UPDATE TO authenticated
  USING (id = auth.uid() AND deleted_at IS NULL) WITH CHECK (id = auth.uid());

CREATE POLICY "pol_usuarios_gerenciar" ON public.usuarios FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'usuario.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'usuario.gerenciar'));

-- ---------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------
CREATE POLICY "pol_perfis_select" ON public.perfis FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_perfis_write" ON public.perfis FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'perfil.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'perfil.gerenciar'));

-- ---------------------------------------------------------------------
-- PERMISSÕES (catálogo)
-- ---------------------------------------------------------------------
CREATE POLICY "pol_permissoes_select" ON public.permissoes FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "pol_permissoes_write" ON public.permissoes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'permissao.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'permissao.gerenciar'));

-- ---------------------------------------------------------------------
-- PERFIL x PERMISSÕES
-- ---------------------------------------------------------------------
CREATE POLICY "pol_perfil_permissoes_select" ON public.perfil_permissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "pol_perfil_permissoes_write" ON public.perfil_permissoes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'perfil.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'perfil.gerenciar'));

-- ---------------------------------------------------------------------
-- USUÁRIO x PERMISSÕES
-- ---------------------------------------------------------------------
CREATE POLICY "pol_usuario_permissoes_select" ON public.usuario_permissoes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_permission(auth.uid(), 'usuario.gerenciar'));

CREATE POLICY "pol_usuario_permissoes_write" ON public.usuario_permissoes FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'usuario.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'usuario.gerenciar'));

-- ---------------------------------------------------------------------
-- USUÁRIO x UNIDADES
-- ---------------------------------------------------------------------
CREATE POLICY "pol_usuario_unidades_select" ON public.usuario_unidades FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_permission(auth.uid(), 'usuario.gerenciar'));

CREATE POLICY "pol_usuario_unidades_write" ON public.usuario_unidades FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'usuario.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'usuario.gerenciar'));

-- ---------------------------------------------------------------------
-- USUÁRIO x SECRETARIAS
-- ---------------------------------------------------------------------
CREATE POLICY "pol_usuario_secretarias_select" ON public.usuario_secretarias FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_permission(auth.uid(), 'usuario.gerenciar'));

CREATE POLICY "pol_usuario_secretarias_write" ON public.usuario_secretarias FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), 'usuario.gerenciar'))
  WITH CHECK (public.has_permission(auth.uid(), 'usuario.gerenciar'));
