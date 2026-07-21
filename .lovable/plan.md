## Objetivo

Transformar as telas **Folha – Efetivos**, **Folha – Contratados** e **Piso da Enfermagem** em um ambiente de conferência gerencial, apenas na camada de UI, sem tocar em regras de negócio, cálculos, APIs, permissões ou banco.

Todos os dados usados já existem no cadastro do profissional (`profissionais`, `frequencias`, `frequencias_contratados`, `piso_enfermagem`) e serão apenas enriquecidos/derivados no frontend.

## Escopo (o que muda)

Somente arquivos de UI/frontend:

- `src/components/frequencias/frequencias-efetivos-page.tsx`
- `src/components/frequencias/frequencias-contratados-page.tsx`
- `src/routes/_authenticated/piso-enfermagem.index.tsx`
- Novos componentes compartilhados em `src/components/shared/gerencial/`
- Um helper puro em `src/lib/situacao-funcional.ts` (derivações a partir dos campos já existentes)

**Fora de escopo (não será tocado):** migrations, RPCs, `.functions.ts` de folha/piso, cálculos financeiros, permissões, regras de competência, fluxos de importação/aprovação.

## Componentes novos (compartilhados)

Criados em `src/components/shared/gerencial/`, reutilizando `KpiCard`, `StatusBadge`, `DataTable`, `EmptyState`, `FilterBar`, `Tooltip`, `Sheet` (drawer) e `PermissionGate` já existentes:

1. **`SituacaoBadge`** — badge colorido por situação funcional (Ativo/Férias/Licença/Afastado/Desligado). Usa `StatusBadge` com um novo domínio `situacao_funcional` registrado em `src/lib/status.ts`.
2. **`SituacaoResumo`** — faixa de KPIs (Ativos, Férias, Licença, Afastados, Pendências, Não Elegíveis) usando `KpiCard`.
3. **`SituacaoFilter`** — chips de filtro rápido por situação, plugado no `FilterBar` de cada página.
4. **`ProfissionalNomeCell`** — célula fixa com nome + `SituacaoBadge` + ícone de alerta quando há pendências cadastrais; envolvida em `Tooltip` com resumo (CPF, cargo, função, unidade, banco).
5. **`ElegibilidadePisoBadge`** — badge Elegível / Revisar / Não elegível, derivado de regras puras (cargo pertence a Enfermagem, tem CPF, tem vínculo ativo, tem dados bancários). Puramente visual — **não altera nenhum cálculo do piso**.
6. **`AlertasDrawer`** — `Sheet` lateral com lista consolidada de inconsistências da competência (sem banco, sem lotação, sem cargo, sem função, sem CPF, pendências).
7. **`DossieDrawer`** — `Sheet` lateral que reaproveita o dossiê já existente (`src/lib/dossie.ts` + `src/components/profissionais/dossie`) em modo compacto ao clicar no nome.

## Helper de derivação

`src/lib/situacao-funcional.ts` — funções puras:

- `derivarSituacao(prof)` → `'ativo' | 'ferias' | 'licenca' | 'afastado' | 'desligado'` a partir dos campos já existentes em `profissionais` / `profissional_historico_funcional`.
- `derivarAlertas(prof)` → lista tipada de pendências cadastrais.
- `derivarElegibilidadePiso(prof, contexto)` → `'elegivel' | 'revisar' | 'nao_elegivel'` conforme regras configuráveis (constantes no topo do arquivo, fáceis de ajustar).
- `contarSituacoes(linhas)` → totais para os KPIs.

Cobertura por testes unitários em `situacao-funcional.test.ts`.

## Integração nas 3 páginas

Em cada página, na mesma ordem:

1. Adicionar `SituacaoResumo` acima do `FilterBar` (Efetivos e Contratados usam os totais da folha carregada; Piso usa os totais da competência ativa).
2. Adicionar `SituacaoFilter` dentro do `FilterBar` existente.
3. Substituir a coluna "Nome" pela `ProfissionalNomeCell` (nome + `SituacaoBadge` + ícone de alerta + tooltip). Coluna fica sticky à esquerda via classe utilitária.
4. Adicionar coluna "Elegibilidade ao Piso" com `ElegibilidadePisoBadge` (nas 3 telas — nas de folha aparece como informativo).
5. Destacar a linha (borda/ background suave) quando `derivarAlertas(prof).length > 0` — reforço visual de "precisa conferência".
6. Adicionar botão flutuante "Alertas da competência" que abre `AlertasDrawer`.
7. Clique no nome abre `DossieDrawer` com o resumo do profissional.

Nenhuma query, mutation, cálculo ou RLS é alterado — o enriquecimento acontece no `useMemo` sobre as linhas já retornadas.

## Design System

- Cores: `SituacaoBadge` usa tokens semânticos já existentes (`--success`, `--warning`, `--destructive`, `--info`, `--muted`) — se algum faltar, é adicionado em `src/styles.css` via `@theme inline` mapeando para variáveis existentes.
- Sem hardcode de cores nos componentes. Sem quebra de responsividade — a coluna sticky usa `md:` breakpoints.
- Ícones via `lucide-react` (já em uso).

## Entregáveis

- 1 helper + testes: `src/lib/situacao-funcional.ts` (+ `.test.ts`).
- 7 componentes em `src/components/shared/gerencial/`.
- Ajustes nas 3 páginas listadas.
- Registro do domínio `situacao_funcional` em `src/lib/status.ts`.
- Nenhuma migration, nenhuma edge function, nenhuma alteração em `.functions.ts`.
