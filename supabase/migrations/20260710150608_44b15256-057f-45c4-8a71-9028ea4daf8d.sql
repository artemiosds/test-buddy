
-- =====================================================================
-- REFINAMENTO 01e — SEMENTES INICIAIS
-- =====================================================================

-- ---------- VÍNCULOS PADRÃO ----------
INSERT INTO public.vinculos (nome, codigo, natureza, categoria, requer_concurso, permite_acumulo, base_legal, descricao)
VALUES
  ('Estatutário',        'EST',  'estatutario',   'efetivo',    true,  true,  'Lei nº 8.112/1990 e legislação municipal', 'Servidor efetivo regido por estatuto próprio'),
  ('Celetista',          'CLT',  'celetista',     'efetivo',    true,  true,  'Decreto-Lei nº 5.452/1943 (CLT)',          'Empregado público regido pela CLT'),
  ('Comissionado',       'COM',  'comissionado',  'contratado', false, false, 'Legislação municipal',                      'Cargo de livre nomeação e exoneração'),
  ('Contrato Temporário','TEMP', 'temporario',    'contratado', false, false, 'Lei nº 8.745/1993 e legislação municipal',  'Contratação por tempo determinado para excepcional interesse público'),
  ('Terceirizado',       'TERC', 'terceirizado',  'contratado', false, false, 'Lei nº 14.133/2021',                        'Prestador via empresa contratada'),
  ('Estagiário',         'EST-E','estagiario',    'contratado', false, false, 'Lei nº 11.788/2008',                        'Vínculo educacional supervisionado'),
  ('Residente',          'RES',  'residente',     'contratado', false, false, 'Lei nº 11.129/2005',                        'Residência multiprofissional/médica em saúde')
ON CONFLICT (codigo) DO NOTHING;

-- ---------- FERIADOS NACIONAIS 2026 ----------
INSERT INTO public.calendario_institucional (data, descricao, tipo, abrangencia, ato_normativo, eh_recorrente)
VALUES
  ('2026-01-01', 'Confraternização Universal',       'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-04-21', 'Tiradentes',                        'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-05-01', 'Dia do Trabalho',                   'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-09-07', 'Independência do Brasil',           'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-10-12', 'Nossa Senhora Aparecida',           'feriado_nacional', 'nacional', 'Lei nº 6.802/1980',  true),
  ('2026-11-02', 'Finados',                           'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-11-15', 'Proclamação da República',          'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'feriado_nacional', 'nacional', 'Lei nº 14.759/2023', true),
  ('2026-12-25', 'Natal',                             'feriado_nacional', 'nacional', 'Lei nº 662/1949',    true)
ON CONFLICT (data, descricao, abrangencia) DO NOTHING;
