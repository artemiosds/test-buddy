# Plan - Estabilização do Relatório de Dados Salariais

Este plano foca em resolver as instabilidades e erros (Invariant failed) relatados no relatório de Dados Salariais, além de aprimorar a UX e a precisão dos dados.

## User Review Required

> [!IMPORTANT]
> O sistema agora valida mais rigorosamente a entrada de valores monetários nos filtros. Se você digitar um valor inválido (como "abc"), ele será ignorado no filtro para evitar erros de cálculo.

## Proposed Changes

### 1. Estabilização de Roteamento e Estado
- Refatorar a captura de parâmetros de busca (`search params`) para ser resiliente a navegações rápidas e mudanças de rota.
- Corrigir o erro "Invariant failed" garantindo que todas as sub-etapas do Wizard recebam as propriedades necessárias (`isSalarial`, `mode`).
- Sincronizar os filtros iniciais da URL com o estado interno do componente de forma reativa.

### 2. Tratamento de Erros e Resiliência
- Implementar blocos `try-catch` nas funções de geração de linhas e agrupamento para evitar que um erro em um bloco específico quebre toda a página.
- Adicionar logs de erro detalhados no console para facilitar diagnósticos futuros de "instabilidades fantasmas".

### 3. Melhoria na Precisão de Dados e Formatação
- Expandir a formatação automática de moeda (BRL) para todos os campos financeiros em todos os formatos de exportação (PDF Institucional, PDF ABNT).
- Garantir que a ordenação padrão por "Nome Completo" seja aplicada automaticamente em relatórios salariais.
- Ajustar a lógica de filtragem por faixa salarial para ser mais permissiva com diferentes formatos de entrada (R$, pontos, vírgulas).

### 4. Aprimoramento da UX
- Garantir que o modo "Salarial Rápido" (acessado pelo botão de relatório rápido) tenha o mesmo nível de polimento e funcionalidades que o "Dados Salariais" completo.

## Technical Details

- **Arquivos afetados**:
    - `src/routes/_authenticated/relatorio-inteligente.tsx`: Reestruturação do estado e roteamento.
    - `src/lib/relatorio-inteligente/render.ts`: Atualização da lista de campos monetários.
    - `src/lib/relatorio-inteligente/export-multi.ts`: Melhoria na formatação de células e subtotais.
    - `src/lib/relatorio-inteligente/export-pdf-abnt.ts`: Inclusão de formatação BRL na tabela ABNT.
- **Segurança**: Nenhuma alteração de RLS ou permissões necessária; o foco é puramente na camada de apresentação e lógica de cliente.
