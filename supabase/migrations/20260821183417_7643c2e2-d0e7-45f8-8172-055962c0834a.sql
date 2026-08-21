-- 1. Políticas de RLS para a tabela public.usuarios (Escrita para Master)
DO $$ 
BEGIN
    -- DROP EXISTING if needed (optional but safer for idempotency if we want clean ones)
    DROP POLICY IF EXISTS "Master pode inserir usuários" ON public.usuarios;
    DROP POLICY IF EXISTS "Master pode atualizar usuários" ON public.usuarios;
    DROP POLICY IF EXISTS "Master pode deletar usuários" ON public.usuarios;
END $$;

CREATE POLICY "Master pode inserir usuários"
ON public.usuarios
FOR INSERT
TO authenticated
WITH CHECK (is_master(auth.uid()));

CREATE POLICY "Master pode atualizar usuários"
ON public.usuarios
FOR UPDATE
TO authenticated
USING (is_master(auth.uid()))
WITH CHECK (is_master(auth.uid()));

CREATE POLICY "Master pode deletar usuários"
ON public.usuarios
FOR DELETE
TO authenticated
USING (is_master(auth.uid()));

-- 2. Garantir privilégios nas tabelas de vínculo para Master se não existirem
-- Tabela usuario_permissoes (já parece ter, mas reforçar)
DROP POLICY IF EXISTS "pol_usuario_permissoes_write_master" ON public.usuario_permissoes;
CREATE POLICY "pol_usuario_permissoes_write_master"
ON public.usuario_permissoes
FOR ALL
TO authenticated
USING (is_master(auth.uid()))
WITH CHECK (is_master(auth.uid()));

-- Tabela usuario_unidades (já tem mutação universal, mas vamos ser específicos)
DROP POLICY IF EXISTS "pol_usuario_unidades_write_master" ON public.usuario_unidades;
CREATE POLICY "pol_usuario_unidades_write_master"
ON public.usuario_unidades
FOR ALL
TO authenticated
USING (is_master(auth.uid()))
WITH CHECK (is_master(auth.uid()));

-- Tabela usuario_secretarias
DROP POLICY IF EXISTS "pol_usuario_secretarias_write_master" ON public.usuario_secretarias;
CREATE POLICY "pol_usuario_secretarias_write_master"
ON public.usuario_secretarias
FOR ALL
TO authenticated
USING (is_master(auth.uid()))
WITH CHECK (is_master(auth.uid()));

-- 3. Garantir GRANTs (Regra de Ouro)
GRANT ALL ON public.usuarios TO authenticated;
GRANT ALL ON public.usuarios TO service_role;

GRANT ALL ON public.usuario_permissoes TO authenticated;
GRANT ALL ON public.usuario_permissoes TO service_role;

GRANT ALL ON public.usuario_unidades TO authenticated;
GRANT ALL ON public.usuario_unidades TO service_role;

GRANT ALL ON public.usuario_secretarias TO authenticated;
GRANT ALL ON public.usuario_secretarias TO service_role;
