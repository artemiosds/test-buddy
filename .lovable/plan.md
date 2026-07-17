
# Dossiê Funcional do Profissional

Transformar `/profissionais/$id` em um dossiê completo, **sem** criar migrações, alterar APIs, cálculos, permissões ou funcionalidades atuais. Toda a informação vem de tabelas/hooks já existentes (`profissionais`, `profissional_historico_funcional`, `frequencia_profissional`, `frequencias`, `pendencias`, `audit_log`, `use-analytics`, `use-lookups`).

## Escopo (o que existe hoje x o que falta)

A rota já tem 926 linhas com abas Dados, Timeline (histórico funcional), Pendências, Estatísticas. Vamos **reorganizar e enriquecer** — não reescrever do zero — mantendo mutações e RLS atuais.

## Sublotes

### 13A — Cabeçalho Executivo + Resumo
- Novo componente `ProfissionalHeader` (`src/components/profissionais/dossie/`) exibindo: foto (avatar fallback), nome, matrícula, CPF, cargo/função atual, unidade/setor, vínculo, status, data admissão, **tempo de serviço calculado** (`formatters.ts::formatTempoServico`, novo helper puro).
- `ResumoExecutivoCard`: derivado dos dados já consultados (contagens de unidades/setores/cargos/funções distintos no histórico funcional, competências processadas via `frequencia_profissional`, pendências abertas, % frequências aprovadas, dias desde última movimentação).

### 13B — Reorganização em abas (Tabs shadcn existente)
Ordem final: **Visão Geral · Linha do Tempo · Lotações · Competências · Movimentações · Documentos · Observações**.
- Aba "Dados" atual vira "Visão Geral" (mantém formulário de edição intacto).
- Aba "Histórico" atual é dividida em "Linha do Tempo" (vertical) + "Movimentações" (tabela filtrada por tipos de mudança).

### 13C — Linha do Tempo funcional
- Componente `TimelineFuncional` renderizando eventos de `profissional_historico_funcional` já carregados + eventos derivados (competências enviadas/aprovadas de `frequencia_profissional` do profissional, licenças/afastamentos do próprio histórico).
- Sem nova query: reutiliza `historico` e adiciona um `useQuery` leve para últimas competências (já disponível via `useAnalytics`/`frequencia_profissional`).

### 13D — Histórico de Lotações
- Tabela `LotacoesTable` (DataTable existente) derivada de `profissional_historico_funcional` filtrando eventos com `unidade_destino_id`/`setor_destino_id`, ordenada por período, com colunas Unidade, Setor, Cargo, Função, Início, Fim (próximo evento), Motivo, Situação.

### 13E — Histórico de Competências + Indicadores Individuais
- Nova query dedicada `frequencia_profissional` por `profissional_id` (já permitida pela RLS existente) trazendo competência, unidade, situação, horas extras, faltas, pendências relacionadas.
- Filtros por Ano/Competência/Unidade via `FilterBar` compartilhado.
- Cards de indicadores (total competências, frequências, HE, faltas, pendências abertas/resolvidas, tempo na unidade/setor/serviço).

### 13F — Evolução Funcional + Situação Funcional
- Painel "antes → depois" para cargo/função/última movimentação/última atualização cadastral (usa `audit_log` já existente, filtrado por `entity_id = profissional`).
- Bloco Situação Funcional com badge atual + histórico de mudanças de `situacao_funcional` do `audit_log`.

### 13G — Documentos + Observações Administrativas
- Aba **Documentos**: usa `documentos_assinados` (já existente) filtrado por profissional; se vazio, `EmptyState` preparado para futura expansão.
- Aba **Observações**: campo `observacoes` do profissional + últimas 10 entradas de `audit_log` que tocam o registro, com responsável e data.

### 13H — Pesquisa + Exportação
- Input de busca global dentro do dossiê que filtra timeline/lotações/competências/movimentações client-side.
- Botão "Exportar dossiê" gera CSV (helper existente em `src/lib/csv.ts` se houver, senão adicionar utilitário puro sem dep externa) consolidando dados já carregados. **Nenhuma nova API.**

### 13I — Performance & Testes
- Todas as consultas via React Query com `queryKey` estável e `staleTime` alinhado ao `QueryClient` global.
- `useMemo` para derivações (contagem distinta, agrupamentos).
- Testes: adicionar `dossie.test.ts` cobrindo `formatTempoServico`, agregador de resumo executivo e filtro de lotações a partir do histórico funcional. Alvo: suíte cresce de 72 → ~78 verdes.

## Regras invariantes
- Sem migração, sem alteração de schema, RLS, permissões ou mutações existentes.
- Reuso obrigatório: `PageHeader`, `DataTable`, `EmptyState`, `FilterBar`, `StatusBadge`, `KpiCard`, `Tabs`, `useAnalytics`, `use-permissions`, `formatters`.
- Rota permanece protegida pelo `_authenticated` + `PermissionGate` atual (`profissional.visualizar`).
- Nenhum recálculo de folha/frequência: apenas leitura e apresentação.

## Entrega por sublote
Cada sublote fecha com: arquivos alterados, contagem de testes verdes da suíte inteira, e confirmação de que nenhuma lógica de negócio mudou.

Começo por **13A + 13B** (base estrutural) assim que aprovado.
