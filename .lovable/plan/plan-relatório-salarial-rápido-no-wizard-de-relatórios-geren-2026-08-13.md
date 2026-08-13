# Plan - Relatório Salarial Rápido no Wizard de Relatórios Gerenciais

Implementar um atalho "Relatório Salarial Rápido" que pré-configura o Wizard de Relatórios Gerenciais com campos financeiros, filtros aprimorados e lógica de subtotais por Unidade/Cargo tanto na prévia quanto nas exportações.

## User Review Required

> [!IMPORTANT]
> A funcionalidade de "Subtotais por Unidade/Cargo" no PDF/Excel exige que o usuário agrupe o relatório por esses campos na Etapa 5 do Wizard. O atalho irá pré-configurar esse agrupamento automaticamente.

## Proposed Changes

### 1. Centralização de Filtros (Etapa 2)
- Criar `src/lib/relatorio-inteligente/filtros.functions.ts` para buscar Unidades, Cargos e Vínculos do banco via Server Function.
- Integrar filtros de multi-seleção na Etapa 3 do Wizard em `src/routes/_authenticated/relatorio-inteligente.tsx`.

### 2. Atalho "Relatório Salarial Rápido" (Etapa 1 & 4)
- Adicionar o botão "⚡ Relatório Salarial Rápido" em `src/routes/_authenticated/relatorios-gerenciais.index.tsx`.
- Proteção por permissão: O botão só aparece se o usuário tiver acesso a dados salariais (validado via `useCurrentUser`).
- Ao clicar, redirecionar para o Wizard com parâmetros na URL (ou estado global) que forçam:
    - Seleção do bloco `cadastro_profissionais`.
    - Marcação dos 7 campos salariais + Nome, Matrícula, Cargo, Unidade, Vínculo.
    - Pré-configuração do Agrupamento (GroupBy) por Unidade e Cargo na Etapa 5.

### 3. Totais e Subtotais (Etapa 3)
- **Cálculo:** Aprimorar `src/lib/relatorio-inteligente/agrupamento.ts` para garantir que estatísticas de soma sejam calculadas para todos os campos financeiros selecionados.
- **Visualização (Tela):** Exibir linhas de subtotal na `GroupNodeView` dentro do `relatorio-inteligente.tsx`.
- **Exportação (PDF/Excel/CSV):**
    - **PDF:** `src/lib/pdf-assinaturas.ts` (ou similar) já possui suporte a `foot` no `jspdf-autotable`, garantir que os subtotais sejam injetados corretamente.
    - **Excel:** Atualizar `exportarExcelMulti` em `export-multi.ts` para incluir linhas de subtotal entre grupos.
    - **CSV:** Adicionar linhas de totais ao final do arquivo.

## Technical Details

- **Filtros:** Reaproveitar componentes `MultiSelect` (se disponíveis) ou `Select` padrão do shadcn.
- **Campos Salariais:**
    - `salario_base`, `salario_bruto`, `salario_liquido`, `horas_extras`, `adicional_noturno`, `gratificacao_incentivo`, `vencimento_liquido`.
- **Lógica de Agrupamento:** Se múltiplos níveis forem selecionados (ex: Unidade > Cargo), o sistema mostrará a árvore com subtotais em cada nó.
- **Hook de Dados:** Continuar usando `useProfissionaisLista` para garantir performance (cache do TanStack Query).

## Verification Plan

### Automated Tests
- Validar se a Server Function de filtros retorna os dados corretos.
- Testar a lógica de `agrupar()` com campos financeiros simulados.

### Manual Verification
1. Acessar como Master -> Ver botão "Relatório Salarial Rápido".
2. Clicar no botão -> Wizard deve abrir na Etapa 2 (Campos) com 12 campos marcados.
3. Avançar para Etapa 6 (Prévia) -> Ver subtotais por Unidade (se agrupado).
4. Aplicar filtro de Unidade -> Verificar se o Total Geral atualiza.
5. Exportar PDF -> Verificar se o layout A4 Paisagem mantém o cabeçalho institucional e as somas no rodapé das tabelas.
6. Acessar com perfil sem permissão salarial -> Verificar se o atalho sumiu.
