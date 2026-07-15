
-- =====================================================================
-- REFINAMENTO 01b — ÍNDICES DA FUNDAÇÃO ORGANIZACIONAL
-- =====================================================================

-- SECRETARIAS
CREATE UNIQUE INDEX ux_secretarias_cnpj_ativo ON public.secretarias(cnpj) WHERE deleted_at IS NULL AND cnpj IS NOT NULL;
CREATE INDEX ix_secretarias_status ON public.secretarias(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_secretarias_nome_trgm ON public.secretarias USING gin (nome extensions.gin_trgm_ops);
CREATE INDEX ix_secretarias_deleted_at ON public.secretarias(deleted_at);

-- MUNICIPIO_CONFIG
CREATE UNIQUE INDEX ux_municipio_config_ibge_ativo ON public.municipio_config(codigo_ibge) WHERE deleted_at IS NULL AND codigo_ibge IS NOT NULL;
CREATE UNIQUE INDEX ux_municipio_config_cnpj_ativo ON public.municipio_config(cnpj_prefeitura) WHERE deleted_at IS NULL AND cnpj_prefeitura IS NOT NULL;
CREATE INDEX ix_municipio_config_secretaria ON public.municipio_config(secretaria_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_municipio_config_uf ON public.municipio_config(uf) WHERE deleted_at IS NULL;

-- UNIDADES
CREATE INDEX ix_unidades_secretaria ON public.unidades(secretaria_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_unidades_cnes_ativo ON public.unidades(cnes) WHERE deleted_at IS NULL AND cnes IS NOT NULL;
CREATE UNIQUE INDEX ux_unidades_cnpj_ativo ON public.unidades(cnpj) WHERE deleted_at IS NULL AND cnpj IS NOT NULL;
CREATE INDEX ix_unidades_status ON public.unidades(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_unidades_tipo ON public.unidades(tipo_unidade) WHERE deleted_at IS NULL;
CREATE INDEX ix_unidades_complexidade ON public.unidades(nivel_complexidade) WHERE deleted_at IS NULL;
CREATE INDEX ix_unidades_nome_trgm ON public.unidades USING gin (nome extensions.gin_trgm_ops);
CREATE INDEX ix_unidades_deleted_at ON public.unidades(deleted_at);

-- SETORES
CREATE INDEX ix_setores_unidade ON public.setores(unidade_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_setores_status ON public.setores(status) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_setores_nome_unidade_ativo ON public.setores(unidade_id, nome) WHERE deleted_at IS NULL;
CREATE INDEX ix_setores_nome_trgm ON public.setores USING gin (nome extensions.gin_trgm_ops);

-- FUNDOS
CREATE UNIQUE INDEX ux_fundos_cnpj_ativo ON public.fundos(cnpj) WHERE deleted_at IS NULL AND cnpj IS NOT NULL;
CREATE INDEX ix_fundos_status ON public.fundos(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_fundos_esfera ON public.fundos(esfera) WHERE deleted_at IS NULL;

-- CARGOS
CREATE UNIQUE INDEX ux_cargos_codigo_ativo ON public.cargos(codigo) WHERE deleted_at IS NULL AND codigo IS NOT NULL;
CREATE INDEX ix_cargos_cbo ON public.cargos(cbo) WHERE deleted_at IS NULL AND cbo IS NOT NULL;
CREATE INDEX ix_cargos_nivel ON public.cargos(nivel) WHERE deleted_at IS NULL;
CREATE INDEX ix_cargos_grupo ON public.cargos(grupo_ocupacional) WHERE deleted_at IS NULL;
CREATE INDEX ix_cargos_status ON public.cargos(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_cargos_nome_trgm ON public.cargos USING gin (nome extensions.gin_trgm_ops);

-- FUNCOES
CREATE UNIQUE INDEX ux_funcoes_codigo_ativo ON public.funcoes(codigo) WHERE deleted_at IS NULL AND codigo IS NOT NULL;
CREATE INDEX ix_funcoes_status ON public.funcoes(status) WHERE deleted_at IS NULL;

-- VINCULOS
CREATE INDEX ix_vinculos_natureza ON public.vinculos(natureza) WHERE deleted_at IS NULL;
CREATE INDEX ix_vinculos_categoria ON public.vinculos(categoria) WHERE deleted_at IS NULL;
CREATE INDEX ix_vinculos_status ON public.vinculos(status) WHERE deleted_at IS NULL;

-- CALENDARIO_INSTITUCIONAL
CREATE INDEX ix_calendario_data ON public.calendario_institucional(data) WHERE deleted_at IS NULL;
CREATE INDEX ix_calendario_tipo ON public.calendario_institucional(tipo) WHERE deleted_at IS NULL;
CREATE INDEX ix_calendario_abrangencia ON public.calendario_institucional(abrangencia) WHERE deleted_at IS NULL;
CREATE INDEX ix_calendario_ano ON public.calendario_institucional((EXTRACT(YEAR FROM data))) WHERE deleted_at IS NULL;
