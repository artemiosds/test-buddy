# Plano de Restauração: Tela de Resumo Estrutural (Dashboard Clássico)

O usuário deseja restaurar a simplicidade da tela inicial original, que servia como uma "capa" com indicadores rápidos e gráficos essenciais, antes da expansão para o modelo Analítico/Executivo.

## Alterações Propostas

### 1. Criar Componente de Legado para o Dashboard Clássico
- Implementar um novo componente em `src/components/dashboard/DashboardClassico.tsx`.
- **Layout**:
    - Topo: 4 a 5 cards de indicadores (Total, Ativos, Afastados, Férias, Valor da Folha).
    - Corpo: Dois gráficos principais em destaque (Barras para Gastos Mensais e Pizza para Vínculo).
    - Estilo: Limpo, com bordas arredondadas de 18px (conforme padrão SaaS Enterprise atual).

### 2. Restaurar a Rota Raiz (`/`)
- Modificar `src/routes/index.tsx` para remover o redirecionamento automático para `/analitico`.
- Renderizar o `DashboardClassico` como a porta de entrada do sistema.

### 3. Ajustar Navegação
- Manter os Dashboards Analítico e Executivo no menu lateral, mas definir a rota `/` como a "Visão Geral" simplificada.

## Detalhes Técnicos
- Utilizar os hooks de dados existentes (`useAnalytics`, `useQuery`) para garantir que os dados sejam reais e sincronizados.
- Manter a paleta Teal/Slate e fontes Inter.
- Garantir que o MASTER continue tendo bypass em todas as travas.
