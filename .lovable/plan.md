
# Sublote 3C — Consolidação final da camada de UI compartilhada

Objetivo: fechar a refatoração estrutural do frontend introduzindo os três blocos
reservados nos sublotes anteriores (Skeleton, ConfirmDialog, Lookups) e
absorvendo o débito remanescente do `DataTable`/`FilterBar`. Sem alteração
visual, funcional, de regras, layout, banco ou permissões.

## Escopo

1. **Skeletons de listagem/KPIs**
   - Novo `src/components/shared/Skeletons.tsx`:
     - `TableSkeleton` (linhas × colunas configuráveis)
     - `KpiCardSkeleton` e `KpiGridSkeleton`
     - `DetailSkeleton` (blocos de página de detalhe)
   - `DataTable` passa a renderizar `TableSkeleton` no estado `loading`
     (substitui o placeholder textual "Carregando…" atual, preservando o
     mesmo layout de colunas).
   - `KpiCard` ganha estado `loading` unificado usando `KpiCardSkeleton`
     (já existia `loading` → migra para skeleton em vez do texto "…").

2. **ConfirmDialog compartilhado**
   - Novo `src/components/shared/ConfirmDialog.tsx` sobre `AlertDialog`
     shadcn: props `title`, `description`, `confirmLabel`, `cancelLabel`,
     `tone: "default" | "destructive"`, `open`, `onOpenChange`, `onConfirm`,
     `loading`.
   - Hook opcional `useConfirm()` para uso imperativo em handlers
     (`await confirm({...})`).
   - Substitui `AlertDialog` inline em rotas que já usam confirmação
     (usuarios, unidades, feriados, assinaturas, seguranca, notificacoes,
     profissionais listagem e detalhe). Nenhuma nova confirmação é
     introduzida — apenas troca de estrutura.

3. **Lookups compartilhados (hooks)**
   - Novo `src/hooks/use-lookups.ts` com queries reutilizáveis e chaves
     estáveis:
     - `useUnidadesLookup({ ativasOnly? })`
     - `useSetoresLookup({ unidadeId? })`
     - `useCargosLookup()`, `useFuncoesLookup()`, `useVinculosLookup()`
     - `useCompetenciasLookup({ status? })`
     - `useTiposUnidadeLookup()`
   - Cada hook: `staleTime: 5 min`, `select` mínimo (id/nome/sigla), sem
     `refetchOnWindowFocus`. Reaproveita QueryClient global do Sublote 2.
   - Rotas migradas para consumir os hooks (elimina `useQuery` inline
     duplicado). Alvo prioritário: `gestao-rh`, `relatorios`,
     `relatorios-executivo`, `relatorios-consolidado`,
     `relatorios-status`, `relatorios-profissional`, `analitico`,
     `aprovacoes`, `frequencias`, `controle-forca-trabalho`,
     `sala-situacao`, `profissionais`, `setores`, `cargos-funcoes`,
     `assinaturas`. Consultas com filtros específicos (ex.: joins/count)
     permanecem locais.

4. **Débito residual do 3B**
   - `FilterBar` ganha helper `FilterBar.Field` para padronizar
     `label + Select/Input` (elimina blocos `<div><label/>Select</div>`
     repetidos em ~10 rotas — troca cosmética apenas).
   - Tabelas com `colSpan` para empty/loading migram para `DataTable`
     onde couber sem alterar layout; casos com colunas dinâmicas ficam
     documentados como divergência aceita.

## Fora de escopo (mantido para ondas seguintes)

- Alterações de layout, cores ou tipografia (Onda 4).
- Novas telas, novos filtros ou novas ações destrutivas.
- Refatoração de páginas de PDF (`pdf-*`) e edge functions.
- Consolidação de formulários (dialogos de criação/edição) —
  reservado para eventual Sublote 3D se necessário.

## Detalhes técnicos

- `ConfirmDialog` controlado por props (padrão) + `useConfirm()` opcional
  via provider montado em `src/routes/__root.tsx` dentro de
  `RootComponent` (não afeta SSR — provider client-side).
- `Skeletons` usam `Skeleton` de `@/components/ui/skeleton`, respeitando
  tokens (`bg-muted`) — nenhuma cor hardcoded.
- Hooks de lookup exportam tipos (`UnidadeLookup`, etc.) reutilizáveis
  em selects e tabelas.
- `DataTable`: assinatura pública mantida; `loading` agora renderiza
  skeleton com número de linhas = `skeletonRows ?? 5`.

## Ordem de execução

1. Criar `Skeletons.tsx` + adaptar `DataTable`/`KpiCard`.
2. Criar `ConfirmDialog.tsx` + `useConfirm`. Migrar rotas com
   confirmações inline uma a uma.
3. Criar `use-lookups.ts`. Migrar rotas em lote, validando typecheck
   entre cada grupo (relatórios, frequências, cadastros).
4. Introduzir `FilterBar.Field` e limpar duplicações restantes.
5. Rodar `bunx tsgo --noEmit` e busca por padrões legados
   (`useQuery.*unidades.*select.*id, nome`, `AlertDialog` inline em
   rotas, `Carregando…` textual em tabelas).

## Entregas ao final

- Arquivos criados/alterados (lista).
- Componentes compartilhados adicionados (Skeletons, ConfirmDialog,
  FilterBar.Field) e hooks (`use-lookups`).
- Confirmações migradas (contagem).
- Consultas de lookup unificadas (antes/depois).
- Linhas de código eliminadas (estimativa).
- Débito remanescente e justificativa.
- Confirmação de zero regressão (typecheck + inspeção visual das rotas
  principais).
