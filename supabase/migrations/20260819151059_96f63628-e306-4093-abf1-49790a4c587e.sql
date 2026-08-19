-- 1. Reforço das permissões para o Administrador Master principal
INSERT INTO public.usuario_unidades (usuario_id, unidade_id)
SELECT 'cec0cbbf-eb2f-4985-a5d3-df79334dc32a', id
FROM public.unidades
WHERE deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 2. Inserção da permissão com todos os campos obrigatórios
INSERT INTO public.permissoes (codigo, nome, modulo, categoria, ativa, is_sistema)
VALUES ('usuario.gerenciar', 'Gerenciar Usuários e Permissões', 'usuario', 'administracao', true, true)
ON CONFLICT (codigo) DO UPDATE 
SET modulo = 'usuario', categoria = 'administracao', ativa = true;

-- 3. Garantir que o perfil MASTER tenha essa permissão explicitamente se a tabela perfil_permissoes existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'perfil_permissoes') THEN
        INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
        SELECT p.id, perm.id
        FROM public.perfis p, public.permissoes perm
        WHERE p.codigo = 'MASTER' AND perm.codigo = 'usuario.gerenciar'
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
