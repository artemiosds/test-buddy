# Auditoria e Otimização de Permissões, Contexto e Unidades

A auditoria identificou falhas críticas de sincronização entre o banco de dados e o frontend, além de lacunas na interface para usuários MASTER e Diretores. Este plano visa normalizar o escopo de dados e visibilidade em todo o ecossistema.

## 1. Normalização do Banco de Dados (Supabase RPC)

Reconstrução das funções centrais para garantir tipagem e retorno consistentes.

- **get_my_user_context**: Ajustar para retornar `perfil_codigo` e um array JSONB ou Text de UUIDs de unidades vinculadas.
- **is_master**: Refatorar para usar uma lista expansível de códigos de perfil (MASTER, ADMINISTRADOR_MASTER, etc.) e considerar as flags `acesso_todas_unidades` e `acesso_todas_secretarias`.
- **current_user_unidades**: Otimizar para que usuários MASTER recebam todos os IDs de unidades, enquanto Diretores recebam apenas os vínculos diretos.

## 2. Refatoração da Camada de Aplicação (Frontend)

- **useCurrentUser (src/hooks/use-permissions.ts)**:
  - Validar e mapear rigorosamente o retorno da RPC.
  - Assegurar que `is_master` seja calculado de forma resiliente (JWT claim + Fallback RPC + Normalização de string).
- **useUnitScope (src/hooks/use-unit-scope.ts)**:
  - Alterar para retornar não apenas IDs, mas objetos mínimos de unidade `{id, nome}` para evitar múltiplas buscas.
  - Relaxar a flag `locked` para permitir troca entre múltiplas unidades vinculadas (atualmente trava se > 0).

## 3. Melhorias de Interface (UI/UX)

- **Header (_authenticated.tsx)**:
  - Adicionar um Badge visual: "🌍 Acesso Global" (para Master) ou o nome da Unidade selecionada.
  - Exibir o Perfil normalizado de forma clara.
- **UnidadeFilter (src/components/piso/UnidadeFilter.tsx)**:
  - Corrigir a lógica de exibição da opção "Todas as Unidades" para usuários Master.
  - Resolver o loop de atualização que causa o "piscar" dos seletores.

## Detalhes Técnicos

```sql
-- Exemplo da nova estrutura da RPC
CREATE OR REPLACE FUNCTION public.get_my_user_context()
RETURNS jsonb AS $$
  -- Retorna um objeto JSON com: 
  -- id, nome, perfil_codigo, unidades (array de UUID), is_master (boolean)
$$ LANGUAGE plpgsql STABLE;
```

- **Impacto**: Esta mudança desbloqueia telas vazias para Diretores e restaura o poder total de gestão para administradores MASTER.
- **Segurança**: As políticas RLS existentes serão mantidas e apenas terão suas funções de suporte (is_master/current_user_unidades) atualizadas.
