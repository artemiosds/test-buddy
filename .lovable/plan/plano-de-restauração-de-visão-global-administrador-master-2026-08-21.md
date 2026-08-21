# Plano de Restauração de Visão Global (Administrador Master)

Este plano visa corrigir a regressão na visibilidade global do perfil Master no Dashboard e Relatórios, garantindo que o bypass de RLS e filtros de frontend funcione corretamente.

## Alterações

### Frontend - Dashboard e Hooks
- **useUnitScope**: Ajustar para garantir que `selectedUnitId` não seja forçado a uma unidade específica se o usuário for Master.
- **DashboardClassico**: Modificar a chamada do `useAnalytics` para não passar `unidadeId` se for Master (permitindo visão global).
- **useProfissionaisLista**: Corrigir erro de build e garantir que o filtro de unidade seja ignorado para Master.

### Frontend - Relatório Inteligente
- **StepPrevia**: Verificar e ajustar a injeção de filtros para garantir que Master possa ver dados globais nos blocos de visualização.

### Backend - RLS e RPCs
- **RLS (Políticas)**: Validar se as políticas de `profissionais` e `unidades` permitem bypass via `is_master(auth.uid())`.
- **RPC (get_dashboard_summary)**: Confirmar que a função permite `p_unidade_id` nulo para retornar dados globais.

## Detalhes Técnicos
- Uniformizar a lógica de `isMaster` em todos os hooks (`use-permissions`, `use-unit-scope`, `use-analytics`).
- Garantir que `effectiveUnitId` no backend seja `NULL` quando Master não selecionar uma unidade específica.
- Corrigir importações ausentes em `src/hooks/use-profissionais-lista.ts`.

## Verificação
- Acessar o Dashboard como Master e verificar se o total de profissionais reflete a rede toda (ex: 919+).
- Validar se o seletor de unidades no Dashboard permite "Visão Global" ou limpa o filtro.
- Verificar se os KPIs e gráficos estão sincronizados em modo Global.
