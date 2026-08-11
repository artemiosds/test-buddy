# Plano de Recuperação: Estabilização de Perfis e Permissões

O sistema reportou instabilidade no gerenciamento de perfis ("ACABOUU BAGUNÇANDO OS PERFIL DE NOVO"). Este plano visa estabilizar a lógica de RBAC (Controle de Acesso Baseado em Função), garantindo que as mudanças recentes nas migrações de banco de dados (que unificaram a regra de MASTER para exigir AMBAS as flags de acesso e MFA ativo) sejam refletidas corretamente no frontend e nos fluxos de edição.

## Problemas Identificados
1.  **Divergência de Regras**: O frontend possuía fallbacks manuais para `is_master` baseados apenas no código do perfil ("MASTER"), enquanto o banco de dados agora exige flags específicas e MFA ativo.
2.  **Visibilidade de MASTER**: Usuários com o perfil "MASTER" selecionado na UI, mas sem as flags `acesso_todas_unidades` e `acesso_todas_secretarias` no banco, entravam em um estado inconsistente.
3.  **Gate de Manutenção**: O `useModoManutencao` usava uma lógica de `isMaster` que ignorava o gate de MFA, permitindo acesso ao sistema em manutenção mesmo sem o segundo fator verificado.

## Ações Técnicas

### 1. Sincronização de Heurísticas de Autorização
-   Atualizar `src/lib/auth-helpers.ts` para que `temAcessoGlobal` não dependa apenas do código do perfil, mas exija a confirmação explícita de `isMasterClaim` (vindo do RPC).
-   Uniformizar o hook `useModoManutencao` para usar estritamente o `is_master` retornado pelo `UserContext` (que já aplica as regras do banco + MFA).

### 2. Reforço da Interface de Gestão de Usuários
-   Em `src/routes/_authenticated/usuarios.tsx`, garantir que a alteração para o perfil MASTER dispare o alerta correto e que a UI reflita o estado de "Acesso Total" apenas quando as flags de backend estiverem presentes.
-   Remover badges redundantes que confundiam a interpretação do nível de acesso.

### 3. Normalização de Contexto (Frontend)
-   Garantir que `src/hooks/use-permissions.ts` seja a única fonte de verdade, consumindo o JSONB do RPC `get_my_user_context`.

## Próximos Passos
1.  Aplicar as correções de sincronização no `auth-helpers.ts`.
2.  Atualizar o hook de manutenção para fechar a brecha de segurança do bypass de MFA.
3.  Validar a tela de usuários para garantir que a atribuição de perfis não gere erros de sintaxe ou inconsistências visuais.
