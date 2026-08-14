# Plano de Evolução: Relatório de Dados Salariais e Correções de Roteamento

Este plano agora inclui as correções críticas de roteamento e a implementação completa do relatório de "Dados Salariais" com todas as funções avançadas solicitadas.

## Correções Críticas (Bug Fixes)
1. **Roteamento e Path Duplicado**: 
    - Corrigir a causa raiz da duplicação `relatorios-gerenciais/relatorios-gerenciais` garantindo que todos os links no Hub usem caminhos absolutos e removendo atributos `from` que causam conflito no TanStack Router.
    - Resolver o erro `Invariant failed: Could not find an active match` desacoplando o componente `RelatorioInteligentePage` de instâncias específicas de `Route`, usando `useSearch({ strict: false })` e passando parâmetros via props.

## Implementação: Relatório de Dados Salariais
Implementação do bloco `dados_salariais` e interface do Wizard com as especificações solicitadas:

### 1. Núcleo de Dados e Catálogo
- **`src/lib/relatorio-inteligente/catalog.ts`**: Adicionar o bloco `dados_salariais` com a descrição: "Salário base, bruto, líquido e demais rubricas cadastrais por profissional."
- **Campos**: Salário Base, Bruto, Líquido, Horas Extras, Adicional Noturno, Gratificação Incentivo, Vencimento Líquido.
- **Normalização de Cargos**: Implementar na agregação a limpeza de strings (ex: "ENFERMEIRO(A)" e "Enfermeiro" -> "Enfermeiro") para evitar fragmentação nos totais.

### 2. Interface e Filtros Avançados
- **Novos Filtros (Etapa 3)**:
    - **Multi-seleção**: Unidade, Setor, Cargo.
    - **Vínculo**: Efetivo, Comissionado, Prestador de Serviços, Terceirizado.
    - **Status**: Ativo, Inativo, Afastado, Férias, Licença, etc.
    - **Faixa Salarial**: Inputs de valor Mínimo e Máximo (Base, Bruto, Líquido).
    - **Busca por Nome/Matrícula**: Integrar campo de texto global.

### 3. Funções e Dashboards
- **Visão Detalhada vs Resumida**: Implementar alternância na prévia (Tabela completa vs Apenas Totais por Grupo).
- **Comparação Lado a Lado**: Adicionar funcionalidade de comparação rápida entre duas unidades ou dois cargos no dashboard.
- **Gráficos Presets**:
    - Massa salarial bruta por unidade (barras).
    - Distribuição por tipo de vínculo (pizza).
    - Cargos com maior massa salarial (barras).
- **Favoritos**: Integrar ao sistema de "Salvar Modelo" já existente no Wizard.

### 4. Exportação
- Garantir que a exportação (Excel/CSV e PDF) preserve os filtros aplicados e a formatação BRL (R$).

## Detalhes Técnicos
- O relatório utilizará a infraestrutura do `Wizard` gerencial.
- A normalização de cargos será centralizada no `agrupamento.ts` ou `agregacoes.ts`.
- Os filtros de faixa salarial serão processados no hook `useBuiltBlocks` do Wizard.

