-- Adiciona setor_id na tabela frequencias
ALTER TABLE public.frequencias ADD COLUMN setor_id uuid REFERENCES public.setores(id);

-- Atualiza a restrição de unicidade para incluir setor_id
ALTER TABLE public.frequencias DROP CONSTRAINT IF EXISTS frequencias_competencia_unidade_id_tipo_key;

-- Criamos um índice único que trata NULL como um valor fixo para unicidade
CREATE UNIQUE INDEX frequencias_comp_uni_tipo_setor_idx ON public.frequencias (competencia_unidade_id, tipo, (COALESCE(setor_id, '00000000-0000-0000-0000-000000000000'::uuid)));

-- Grants (reforçando)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.frequencias TO authenticated;
GRANT ALL ON public.frequencias TO service_role;
