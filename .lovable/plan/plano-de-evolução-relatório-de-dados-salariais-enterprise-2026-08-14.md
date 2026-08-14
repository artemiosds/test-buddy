# Plano de Evolução: Relatório de Dados Salariais Enterprise

O objetivo é transformar o relatório de "Dados Salariais" em uma ferramenta de auditoria e análise de nível sênior, corrigindo falhas de roteamento, garantindo a integridade dos cálculos e otimizando a visualização para grandes volumes de dados.

## 1. Correção de Roteamento e UX
- **Consertar erro de "Invariant failed"**: Garantir que o acesso via `/relatorio-inteligente?mode=salarios` funcione sem dependência de `strict: true` no `useSearch`.
- **Salto Automático para Prévia**: Ao entrar no modo `salarios`, o Wizard deve pular direto para o passo 6 (Prévia), permitindo que o gestor veja os dados imediatamente, mas podendo voltar para filtrar.
- **Limpeza de Parâmetros**: Remover a necessidade de `from` nos links para evitar duplicação de caminhos.

## 2. Refinamento de Dados e Cálculos
- **Normalização Robusta**: Garantir que campos como `salario_base` e `valor_piso` sejam tratados como sinônimos no motor de cálculo para evitar colunas vazias dependendo do vínculo (Efetivo vs Contratado).
- **Tipagem Estrita no Build**: Forçar a conversão para `Number` em todos os campos financeiros no `catalog.ts` para evitar erros de agregação (NaN).
- **Formatador Centralizado**: Unificar `fmtCell` (Tabela) e `formatterFn` (Gráficos) para usar o mesmo padrão BRL, garantindo que "5000" apareça como "R$ 5.000,00" em todos os lugares.

## 3. Inteligência de Filtros
- **Multi-select de Status**: Adicionar filtros para "Falecido", "Aposentado" e "Cedido", que hoje podem estar misturados no "Inativo".
- **Filtro de Faixa com Regex**: Melhorar o `filterRange` para aceitar valores digitados com "R$", pontos e vírgulas (ex: o usuário digita "5.000,00" e o sistema entende 5000).

## 4. Visualização Enterprise
- **Gráficos de Massa Salarial**: Configurar por padrão gráficos de "Salário Bruto por Unidade" e "Distribuição de Vínculo".
- **Visão Resumida (KPI-First)**: Implementar toggle na prévia que esconde a tabela nominal e foca apenas nos cards de estatísticas (Total da Folha, Média, Máximo).
- **Exportação Agrupada**: Garantir que o PDF e Excel respeitem o agrupamento por Unidade/Setor, gerando sub-totais financeiros automaticamente.

## Detalhes Técnicos
- **Localização**: `src/routes/_authenticated/relatorio-inteligente.tsx`, `src/lib/relatorio-inteligente/catalog.ts`, `src/lib/relatorio-inteligente/agrupamento.ts`.
- **Performance**: Manter o uso de `useProfissionaisLista` com cache para evitar requisições redundantes ao Supabase.
- **Segurança**: Respeitar o RLS já existente para que diretores de unidade vejam apenas seus respectivos profissionais.
