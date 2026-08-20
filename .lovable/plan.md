# Plano de Melhoria: Gestão Multi-Unidade e Seleção Automática

Este plano visa aprimorar a experiência de Diretores de Unidade com múltiplos vínculos, garantindo seleção automática, isolamento correto e eliminação de inconsistências visuais durante o carregamento.

## 1. Refatoração do Hook de Escopo (`useUnitScope`)
- Ajustar a lógica para detectar múltiplos vínculos.
- Adicionar uma flag `hasMultipleUnits` e garantir que `unidadePadraoId` seja a primeira da lista.
- Manter `locked` como `true` apenas se houver exatamente 1 unidade vinculada e o usuário não for global.

## 2. Aprimoramento do Componente `UnidadeFilter`
- Modificar o componente para suportar seleção manual quando `hasMultipleUnits` for verdadeiro.
- Garantir que a primeira unidade seja selecionada automaticamente se nenhum valor for fornecido.
- Remover o fallback "Nenhuma unidade vinculada" se houver dados no lookup.
- Utilizar `TableSkeleton` ou um componente de Loading específico durante a busca de unidades.

## 3. Otimização dos Hooks de Dados (`useProfissionais`, `useAnalytics`, etc.)
- Garantir que as queries de Profissionais e Frequências sejam disparadas imediatamente assim que `unidadeId` for resolvido no hook de escopo ou no estado do componente.
- Adicionar tratamento de carregamento (`isLoading`) para evitar a exibição de contadores zerados ("0") antes da conclusão da query.

## 4. Atualização das Páginas de Frequência (Contratados e Efetivos)
- Ajustar a inicialização do estado `unidadeId` para respeitar a `unidadePadraoId` do hook de escopo.
- Sincronizar a mudança de unidade no dropdown com a atualização imediata da grade de profissionais.

## Detalhes Técnicos
- **Arquivos:** `src/hooks/use-unit-scope.ts`, `src/components/piso/UnidadeFilter.tsx`, `src/hooks/use-profissionais.ts`, `src/components/frequencias/frequencias-contratados-page.tsx`, `src/components/frequencias/frequencias-efetivos-page.tsx`.
- **RBAC:** A lógica de filtragem em `use-analytics.ts` e `use-profissionais.ts` já respeita `isMaster`, mas será reforçada para garantir que Diretores sem unidade selecionada não vejam dados globais indevidamente (embora o RLS já proteja o banco).
- **UX:** Substituição de contadores estáticos "0" por `Skeleton` durante o `fetching`.
