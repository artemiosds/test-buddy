# Plano de Correção: Dashboard Clássico sem Dados

O Dashboard Clássico parou de exibir dados devido a um erro de tipo no banco de dados (`function pg_catalog.btrim(status_frequencia) does not exist`). Isso ocorre porque a função `get_dashboard_summary` tenta aplicar `TRIM()` e `LOWER()` em uma coluna que agora é um `ENUM`, o que o Postgres não permite diretamente.

## Alterações Técnicas

### 1. Banco de Dados (Supabase)
*   Refatorar a função `public.get_dashboard_summary` para converter explicitamente as colunas de ENUM para `TEXT` antes de aplicar funções de string (`TRIM`, `LOWER`).
*   Corrigir o `JOIN` na agregação de vínculos para usar `LEFT JOIN` (garantindo que profissionais sem vínculo cadastrado ainda sejam contados).
*   Garantir que a contagem de profissionais por unidade (`top_unidades`) considere todos os profissionais ativos.

### 2. Frontend (Hooks e Componentes)
*   Validar o estado de `competenciaAtiva` no hook `useAnalytics` para garantir que as queries não rodem com IDs nulos.
*   Adicionar tratamento de erro visual no `DashboardClassico.tsx` para casos onde a RPC falha.

## Passos de Execução

1.  **Migração SQL**: Atualizar a RPC `get_dashboard_summary` com conversões de tipo `::text`.
2.  **Verificação**: Testar a RPC via console do navegador para confirmar que o erro `42883` desapareceu e os dados retornam corretamente.
3.  **Ajuste de UI**: Refinar o componente de dashboard para lidar com estados de carregamento e erro de forma mais elegante.
