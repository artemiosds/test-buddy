# Auditoria de Visibilidade - Diretores de Unidade

## Diagnóstico Técnico
O problema de visibilidade de "Nenhuma unidade vinculada" ou profissionais não aparecendo para Diretores de Unidade, apesar das correções recentes, indica uma falha na cadeia de resolução de permissões entre o banco de dados (RLS) e o carregamento de contexto no Frontend.

### Pontos de Falha Identificados
1. **Divergência de Códigos de Perfil:** O sistema possui variações como `DIRETOR_UNIDADE`, `DIRETOR_DE_UNIDADE` e `GESTOR`. Se o vínculo no banco usar um literal diferente do esperado no código, o filtro falha.
2. **Dependência de `competencia_unidades`:** A RLS de frequências depende da tabela `competencia_unidades`. Se uma unidade estiver vinculada ao usuário, mas não estiver associada à competência ativa na tabela `competencia_unidades`, os registros não aparecem.
3. **Cache de Contexto:** O hook `useCurrentUser` e a função `get_my_user_context` podem estar retornando um snapshot antigo das unidades vinculadas caso a sincronização de claims do Supabase não tenha ocorrido após uma alteração de permissão.
4. **RLS de Profissionais:** A política `profissionais_select` exige `user_has_unit(auth.uid(), unidade_id)`. Se o profissional estiver com `unidade_id` nulo ou em uma unidade que não passou pela função de verificação, ele some da listagem.

## Soluções Propostas

### 1. Robustez na Identificação de Vínculos (SQL)
Reforçar as funções de verificação para garantir que não haja "falso negativo" por sensibilidade a maiúsculas ou espaços.
- **Ação:** Atualizar `public.user_has_unit` para ser mais resiliente.
- **Ação:** Garantir que `public.get_my_user_context` retorne explicitamente a lista de IDs de unidades vinculadas de forma plana.

### 2. Sincronização de Visibilidade no Frontend
Ajustar o carregamento inicial para que o sistema não exiba "Nenhuma unidade" enquanto o contexto do usuário está sendo resolvido.
- **Ação:** Modificar `src/hooks/use-permissions.ts` para garantir que o array `unidades` no `UserContext` seja populado corretamente.

### 3. Ajuste de RLS em Frequências
Simplificar a política para que a verificação de unidade seja direta na tabela de frequências, diminuindo a dependência de joins complexos com competências que podem estar desalinhadas.

## Detalhes Técnicos (Implementação)

### SQL Migration
```sql
-- Garante que a função de verificação seja precisa
CREATE OR REPLACE FUNCTION public.user_has_unit(_user_id uuid, _unidade_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios_unidades
    WHERE usuario_id = _user_id AND unidade_id = _unidade_id
  ) OR is_master(_user_id);
$$;

-- Atualiza a política de profissionais para permitir visualização por hierarquia
DROP POLICY IF EXISTS "profissionais_select" ON public.profissionais;
CREATE POLICY "profissionais_select" ON public.profissionais
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    is_master(auth.uid()) OR 
    user_has_unit(auth.uid(), unidade_id) OR
    (secretaria_id IS NOT NULL AND user_has_secretaria(auth.uid(), secretaria_id))
  )
);
```

### Alterações em Arquivos
- `src/lib/auth-helpers.ts`: Adicionar suporte a `DIRETOR_DE_UNIDADE` como sinônimo no mapeamento.
- `src/routes/_authenticated/profissionais.tsx`: Garantir que o `me?.unidades` seja usado como dependência reativa nos filtros.
