-- PASSO 1: Adicionar campos na tabela avisos_mural
ALTER TABLE public.avisos_mural
ADD COLUMN IF NOT EXISTS ativa_modo_manutencao boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS previsao_termino timestamptz NULL;

COMMENT ON COLUMN avisos_mural.ativa_modo_manutencao 
IS 'Quando true e tipo = manutencao, ativa o modo manutencao global';

COMMENT ON COLUMN avisos_mural.previsao_termino 
IS 'Data/hora prevista para término da manutenção (opcional)';

CREATE INDEX IF NOT EXISTS idx_avisos_mural_manutencao 
ON avisos_mural(ativa_modo_manutencao) 
WHERE ativa_modo_manutencao = true;

-- PASSO 2: Tabela de configuração global
CREATE TABLE IF NOT EXISTS public.sistema_config (
  id                    int PRIMARY KEY DEFAULT 1,
  modo_manutencao_ativo boolean DEFAULT false,
  aviso_manutencao_id   uuid REFERENCES avisos_mural(id) ON DELETE SET NULL,
  ativado_por           uuid REFERENCES auth.users(id),
  ativado_em            timestamptz,
  CONSTRAINT singleton CHECK (id = 1)
);

INSERT INTO public.sistema_config (id) VALUES (1) 
ON CONFLICT (id) DO NOTHING;

GRANT SELECT ON public.sistema_config TO authenticated;
GRANT ALL ON public.sistema_config TO service_role;

ALTER TABLE sistema_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY sistema_config_select_policy 
  ON sistema_config FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY sistema_config_update_policy 
  ON sistema_config FOR UPDATE 
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY sistema_config_insert_policy 
  ON sistema_config FOR INSERT 
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.desativar_modo_manutencao_emergencia()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE sistema_config SET
    modo_manutencao_ativo = false,
    aviso_manutencao_id = null,
    ativado_por = null,
    ativado_em = null
  WHERE id = 1;
  
  UPDATE avisos_mural SET ativa_modo_manutencao = false 
  WHERE ativa_modo_manutencao = true;
END;
$$;
