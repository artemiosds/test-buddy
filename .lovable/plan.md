# Plano de Reformulação do Dashboard Clássico

O objetivo é remover os indicadores e gráficos baseados em estimativas financeiras da `DashboardClassico` e substituí-los por métricas reais e operacionais de gestão de saúde (Unidades e Setores), melhorando a utilidade gerencial da tela.

## Alterações Técnicas

### Frontend

- **Componente `DashboardClassico` (`src/components/dashboard/DashboardClassico.tsx`)**:
    - Remover o `KpiCard` de "Estimativa de Folha".
    - Adicionar um novo `KpiCard` para "Total de Unidades" (usando dados reais do hook `useAnalytics`).
    - Substituir o gráfico de barras "Evolução de Gastos (Estimativa)" por um gráfico de "Distribuição por Unidade" (Top 5 Unidades).
    - Ajustar a tipagem e o mapeamento de cores para os novos gráficos.
    - Garantir que as interações de clique nos novos cards/gráficos redirecionem para as respectivas telas de listagem (`/unidades`, `/setores`).

### Segurança e Dados

- Nenhuma alteração de banco de dados ou RLS é necessária, pois os dados de Unidades e Setores já estão disponíveis via RPC `get_dashboard_summary` e consultas do `useAnalytics`.

## Detalhes Adicionais para o Usuário

- O card de estimativa financeira será substituído pelo contador de **Unidades Ativas**.
- O gráfico de barras de gastos simulados será trocado por um ranking das **5 Unidades com mais profissionais**, oferecendo uma visão real da alocação da força de trabalho.
- O layout continuará limpo e responsivo, mantendo o padrão visual moderno do sistema.
