## Objetivo
Evoluir os dashboards existentes (Executivo, RH, Sala de Situação) em um Centro de Inteligência Gerencial reutilizando 100% da arquitetura atual — sem novas rotas, tabelas, APIs, permissões ou regras de negócio.

## Escopo por sublotes

Execução sequencial. Cada sublote termina com typecheck + `bun test` (53/53) e relatório curto.

### Sublote 12A — Base compartilhada (fundação)
- Estender `src/hooks/use-analytics.ts` com seletores derivados (sem novas queries HTTP):
  - `useSemaforoExecutivo()` → classifica 🟢/🟡/🔴 a partir de contadores já buscados (pendências, alertas, afastados, sem lotação, unidades sem gestor).
  - `useIntegridadeCadastral()` → percentual + breakdown por campo faltante, derivado da lista de profissionais já em cache.
  - `useTendencias(competencia)` → compara competência atual vs. anterior usando `frequencias_*` já carregadas.
  - `useInsightsGerenciais()` → regras determinísticas sobre distribuições existentes (top 1 unidade em HE, setor com maior concentração, etc.).
- Criar componentes compartilhados **presentacionais** em `src/components/intelligence/`:
  - `SemaforoCard.tsx`, `TendenciaKpi.tsx` (sparkline SVG inline), `AlertaItem.tsx`, `InsightCard.tsx`, `IntegridadeCard.tsx`.
- Nenhum componente duplica shadcn/PageHeader/KpiCard existentes — todos os novos são wrappers finos.

### Sublote 12B — Módulo 01 (Semáforo) + 04 (Integridade)
- Inserir `<SemaforoCard/>` no topo de `gestao-pessoas.index.tsx` e `sala-situacao.tsx`.
- Adicionar `<IntegridadeCard/>` como KPI estratégico no Dashboard Executivo, com drill-down abrindo `/profissionais?filter=<campo-faltante>` (usa search params já suportados).

### Sublote 12C — Módulo 02 (Tendências) + 06 (Insights)
- Seção "Tendências" no Dashboard Executivo e Sala de Situação com `TendenciaKpi` (HE, pendências, aprovadas, ativos, afastados, unidades críticas).
- Seção "Inteligência Gerencial" (lista de `InsightCard`) gerada por regras puras.

### Sublote 12D — Módulo 03 (Alertas) + 05 (Cockpit)
- Consolidar alertas existentes de `useAnalytics.alertas` em painel único na Sala de Situação com prioridade/origem/ações (Visualizar → rota existente; Resolver = link para tela responsável, sem mutação nova).
- Reorganizar Dashboard Executivo em cockpit: Semáforo → KPIs estratégicos → Tendências → Alertas resumidos → Ranking → Integridade → Insights.

### Sublote 12E — Filtros globais sincronizados
- Reutilizar `AnalyticsFilters` + URL search params (Competência/Unidade/Setor/Cargo/Função/Vínculo/Status/Ano) nos 3 painéis, garantindo que o estado viaja via `Link`.
- Sem novo contexto: cada rota lê `Route.useSearch()` e passa aos hooks.

### Sublote 12F — Fechamento
- Ajustes de responsivo/tokens.
- Rodar typecheck + `bun test` (esperado 53/53, zero warnings MSW; adicionar handlers se surgirem novas queries — não deve haver).
- Relatório final.

## Regras rígidas
- Nenhuma migration, edge function, RPC, tabela ou permissão nova.
- Nenhuma rota nova no menu — tudo dentro de Dashboard Executivo, Dashboard RH e Sala de Situação.
- Reuso obrigatório: `useAnalytics`, `usePermissions`, `PageHeader`, `KpiCard`, `StatusBadge`, `EmptyState`, `DataTable`, `AnalyticsFilters`, React Query cache.
- Sem consultas N+1: derivações via `useMemo` sobre dados já buscados.

## Detalhes técnicos
- Sparkline: SVG puro (~40 linhas), sem nova dependência.
- Semáforo: função pura `classificar(metricas): 'ok' | 'atencao' | 'critico'` com thresholds em `src/lib/intelligence-thresholds.ts` (constantes revisáveis).
- Insights: gerador `gerarInsights(analytics): Insight[]` — regras determinísticas com i18n pt-BR estático.
- Drill-down: navegação por `Link to="/profissionais" search={{...}}` — filtros já existem em `profissionais.tsx`.

## Entrega esperada por sublote
Typecheck limpo, 53/53 testes, sem warnings MSW, sem alteração de schema, arquivos modificados/criados listados.

Aguardo aprovação para iniciar **12A**.
