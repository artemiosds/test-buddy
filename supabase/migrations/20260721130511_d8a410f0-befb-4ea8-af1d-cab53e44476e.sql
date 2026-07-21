
ALTER TABLE public.assinaturas_institucionais
  ADD COLUMN IF NOT EXISTS posicao_x INTEGER,
  ADD COLUMN IF NOT EXISTS posicao_y INTEGER,
  ADD COLUMN IF NOT EXISTS tamanho_percentual INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS alinhamento TEXT NOT NULL DEFAULT 'direita',
  ADD COLUMN IF NOT EXISTS mostrar_nome BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mostrar_cargo BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.assinaturas_institucionais
  DROP CONSTRAINT IF EXISTS assinaturas_alinhamento_check;
ALTER TABLE public.assinaturas_institucionais
  ADD CONSTRAINT assinaturas_alinhamento_check
  CHECK (alinhamento IN ('esquerda', 'centro', 'direita'));

ALTER TABLE public.assinaturas_institucionais
  DROP CONSTRAINT IF EXISTS assinaturas_tamanho_check;
ALTER TABLE public.assinaturas_institucionais
  ADD CONSTRAINT assinaturas_tamanho_check
  CHECK (tamanho_percentual BETWEEN 50 AND 150);
