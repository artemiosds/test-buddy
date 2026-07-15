ALTER TABLE public.pendencias
  ADD COLUMN IF NOT EXISTS competencia_id uuid REFERENCES public.competencias(id),
  ADD COLUMN IF NOT EXISTS competencia_unidade_id uuid REFERENCES public.competencia_unidades(id),
  ADD COLUMN IF NOT EXISTS origem_entidade text,
  ADD COLUMN IF NOT EXISTS dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS pendencias_competencia_idx ON public.pendencias(competencia_id);
CREATE INDEX IF NOT EXISTS pendencias_competencia_unidade_idx ON public.pendencias(competencia_unidade_id);

INSERT INTO public.permissoes (codigo, nome, modulo, categoria, ativa)
VALUES
  ('pendencia.editar',   'Editar pendência',    'pendencia', 'edicao',        true),
  ('pendencia.reabrir',  'Reabrir pendência',   'pendencia', 'acao',          true),
  ('pendencia.exportar', 'Exportar pendências', 'pendencia', 'acao',          true),
  ('pendencia.imprimir', 'Imprimir pendência',  'pendencia', 'acao',          true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pm.id, true
FROM public.perfis p
CROSS JOIN public.permissoes pm
WHERE p.codigo = 'MASTER'
  AND pm.codigo IN ('pendencia.editar','pendencia.reabrir','pendencia.exportar','pendencia.imprimir')
ON CONFLICT (perfil_id, permissao_id) DO UPDATE SET concedida = true;