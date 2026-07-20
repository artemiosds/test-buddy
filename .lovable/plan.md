## Objetivo

Evoluir `/relatorio-inteligente` de um wizard de 4 etapas com blocos fixos para um **Gerador Corporativo de Relatórios Gerenciais** com wizard de múltiplas etapas, seleção de colunas, filtros avançados, agrupamentos, gráficos configuráveis, parecer técnico, modelos salvos, favoritos e histórico — **sem alterar regras de negócio, folha, competência, cálculos, RLS ou permissões**.

## Escopo (o que muda)

Somente frontend + duas novas tabelas de metadados de usuário (modelos salvos e histórico). Nenhuma alteração em `frequencias`, `piso_enfermagem`, `profissionais`, folha ou competência.

## Nova arquitetura do wizard (10 passos consolidados)

```text
1. Conteúdo   → catálogo de blocos (30+ opções agrupadas por categoria)
2. Campos     → por bloco selecionado, checkboxes de colunas
3. Filtros    → filtros globais + filtros por bloco
4. Ordenação  → coluna + asc/desc por bloco
5. Agrupamento→ árvore Unidade → Setor → Cargo → Função → Profissional
6. Estatísticas → toggles (total, média, mediana, min/max, %, ranking, desvio)
7. Gráficos   → seleção de tipos por bloco (barra, pizza, linha, radar, treemap, pirâmide etária...)
8. Parecer + Índice → toggle parecer técnico + índice automático
9. Prévia     → renderização com dados reais via useGerencial + hooks existentes
10. Exportar/Salvar → PDF Institucional, PDF ABNT, Excel, CSV, Word, Imprimir; Salvar modelo; Favoritar; Registrar no histórico
```

Barra lateral esquerda persistente com **Modelos Salvos**, **Favoritos** e **Histórico**.

## Estrutura de arquivos

**Novo — catálogo declarativo (fonte única de verdade):**
- `src/lib/relatorio-inteligente/catalog.ts` — registry de blocos: `{ id, label, categoria, campos: FieldDef[], filtros: FilterDef[], agrupavelPor: string[], graficosSuportados: ChartType[], selector: (ctx) => Row[] }`. Cada `selector` reusa `useGerencial` e hooks existentes; **nenhuma nova query**.
- `src/lib/relatorio-inteligente/tipos.ts` — tipos `ReportConfig`, `BlockConfig`, `FieldDef`, `FilterDef`, `GroupSpec`, `SortSpec`, `ChartSpec`.
- `src/lib/relatorio-inteligente/agregacoes.ts` — puro: total, média, mediana, min, max, %, ranking, desvio padrão.
- `src/lib/relatorio-inteligente/parecer.ts` — gera parecer técnico a partir de KPIs reais (reutiliza `relatorios-gerenciais-intelligence.ts`).
- `src/lib/relatorio-inteligente/render.ts` — aplica filtros → ordena → agrupa → agrega para uma `ReportConfig`.

**Novo — UI do wizard, um arquivo por etapa:**
- `src/components/relatorio-inteligente/wizard/step-conteudo.tsx`
- `.../step-campos.tsx`
- `.../step-filtros.tsx`
- `.../step-ordenacao.tsx`
- `.../step-agrupamento.tsx`
- `.../step-estatisticas.tsx`
- `.../step-graficos.tsx`
- `.../step-parecer.tsx`
- `.../step-previa.tsx`
- `.../step-exportar.tsx`
- `.../sidebar-modelos.tsx` (Modelos + Favoritos + Histórico)
- `.../grafico-dinamico.tsx` (dispatcher para Recharts: barra/pizza/linha/área/rosca/radar/treemap/pirâmide etária/histograma/dispersão)

**Novo — exportações (estendem o que já existe):**
- `src/lib/relatorio-inteligente/export-pdf-institucional.ts` — jsPDF, paleta AGILIBlue, índice automático, cabeçalho institucional, parecer.
- `src/lib/relatorio-inteligente/export-pdf-abnt.ts` — margens ABNT, Times 12, sumário paginado.
- `src/lib/relatorio-inteligente/export-word.ts` — via `docx` (novo pacote, sob demanda) ou HTML→.doc simples.
- `src/lib/relatorio-inteligente/export-excel.ts` — múltiplas abas (uma por bloco).
- `src/lib/relatorio-inteligente/export-csv.ts` — um CSV por bloco em ZIP quando >1 bloco.

**Modificado:**
- `src/routes/_authenticated/relatorio-inteligente.tsx` — vira orquestrador do wizard + sidebar. Mantém rota e menu existentes.

**Banco (mínimo, apenas metadados do usuário):**
- Migração adicionando:
  - `relatorio_inteligente_modelos (id, user_id, nome, descricao, config jsonb, favorito bool, created_at, updated_at)`
  - `relatorio_inteligente_historico (id, user_id, config jsonb, formato text, total_registros int, tempo_ms int, created_at)`
  - `GRANT` para `authenticated` + `service_role`, RLS por `user_id = auth.uid()`.
- Server functions (client-safe, `*.functions.ts`): `listarModelos`, `salvarModelo`, `favoritarModelo`, `excluirModelo`, `registrarHistorico`, `listarHistorico`.

## Reuso obrigatório (sem duplicar queries)

- `useGerencial` para todos os dados agregados.
- `relatorios-gerenciais-intelligence.ts` para KPIs, semáforo, alertas, índice de qualidade.
- `intelligence-panel.tsx` como fallback quando bloco = "Resumo Executivo".
- Componentes `sections.tsx` (SmartAlerts, ExecutiveSummary, RankingList, ChartCard).
- `relatorios-gerenciais-export.ts` como base do PDF institucional.

## Regras técnicas

- Nenhuma alteração em RLS/permissões existentes; novas tabelas isolam por `user_id`.
- Nenhum recálculo de folha/piso/competência — apenas leitura e apresentação.
- Catálogo declarativo permite adicionar blocos futuros sem refatorar o wizard.
- Todos os cálculos estatísticos são puros e testáveis; adicionar `agregacoes.test.ts`.
- Agendamento **não** é implementado; apenas o campo `agendamento jsonb` no modelo para arquitetura futura.

## Entrega em ondas

1. **Onda A** — Catálogo + tipos + wizard de 10 passos com Conteúdo, Campos, Filtros, Ordenação, Prévia e Exportação PDF/Excel/CSV. Reusa `useGerencial`.
2. **Onda B** — Agrupamento em árvore, Estatísticas automáticas, Gráficos dinâmicos configuráveis.
3. **Onda C** — Parecer técnico + Índice automático + PDF ABNT + Word.
4. **Onda D** — Migração + server functions + Modelos Salvos + Favoritos + Histórico + sidebar.

Confirma que posso seguir com a **Onda A** ou quer priorizar outra ordem?
