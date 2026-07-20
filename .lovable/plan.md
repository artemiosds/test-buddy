# Piso Nacional da Enfermagem — MVP (Fase 1)

Módulo isolado, sem tocar em Folha/Competência/Frequência. Frontend usa componentes shared existentes (`PageHeader`, `KpiCard`, `FilterBar`, `DataTable`, `StatusBadge`, `FormDialog`, `EmptyState`, `ConfirmDialog`).

## Escopo desta fase

Excel/CSV apenas. PDF pesquisável, fuzzy por nome, OCR e desfazer ficam para Fase 2.

## 1. Banco (uma migração)

Novas tabelas em `public`:

- `piso_enfermagem` — snapshot por importação, todos os campos financeiros da spec + `historico_id`, `origem_arquivo`, `data_importacao`, `importado_por`. FK `profissional_id` para `profissionais(id)` nullable (permite registros “não localizados”).
- `historico_importacoes` — cabeçalho da importação (modelo, arquivo, totais, `mapeamento jsonb`, `status`, `importado_por`).
- `piso_mapeamentos_salvos` — mapeamentos reutilizáveis por modelo (nome + jsonb).

Padrão obrigatório do projeto: `CREATE TABLE` → `GRANT` (`authenticated`, `service_role`) → `ENABLE RLS` → policies + trigger `updated_at`.

RLS:
- SELECT: `has_permission(auth.uid(), 'piso.visualizar')` ou `is_master`.
- INSERT/UPDATE/DELETE em `piso_enfermagem` e `historico_importacoes`: `has_permission(auth.uid(), 'piso.importar')` ou `is_master`.
- `piso_mapeamentos_salvos`: mesmas regras de `piso.importar`.

Índices: `piso_enfermagem(historico_id)`, `piso_enfermagem(profissional_id)`, `piso_enfermagem(competencia)`, `historico_importacoes(data_importacao DESC)`.

Permissões novas em `public.permissoes` (`ativa=true`):
- `piso.visualizar`
- `piso.importar`

Vinculadas em `perfil_permissoes` para perfil MASTER. Outros perfis recebem via UI de permissões (fora do escopo desta fase).

## 2. Menu

`AppSidebar`: inserir “Piso Nacional da Enfermagem” entre “Folha Contratados” e “Pendências”, gated por `piso.visualizar`.

## 3. Rotas (todas sob `_authenticated/`, com `PermissionGate`)

- `piso-enfermagem.index.tsx` — lista de importações (histórico) + KPIs (total registros, última importação, divergências). `piso.visualizar`.
- `piso-enfermagem.importar.tsx` — wizard de 3 passos. `piso.importar`.
- `piso-enfermagem.$id.tsx` — detalhe de uma importação (linhas gravadas, filtros por vínculo/status match). `piso.visualizar`.

## 4. Wizard de importação (client-side, sem upload ao Supabase Storage)

Passo 1 — Configuração
- Seletor de modelo: Efetivos / Contratados / Ministério / Personalizado.
- Radio vínculo alvo: Efetivos / Contratados / Ambos.
- Dropzone (`react-dropzone` já não instalado → usar input nativo + drag events, sem dep nova). Aceita `.xlsx`, `.xls`, `.csv`. Limite 50 MB verificado no client.

Passo 2 — Mapeamento
- Parse do arquivo com `xlsx` (já instalado).
- Detecção automática: heurística por nome de header (normalizado sem acento/caixa) → sugere destino. CPF valida por regex; valores por presença de `R$`/número.
- Grid duas colunas: coluna do arquivo → select com campos do sistema (todos os campos financeiros + identificadores).
- Checkboxes “Atualizar campos” controlam quais campos serão persistidos (default: todos financeiros marcados; cargo/unidade/setor desmarcados).
- Botão “Salvar mapeamento” grava em `piso_mapeamentos_salvos` (usa nome informado + modelo).
- Botão “Carregar mapeamento” lista os salvos por modelo.

Passo 3 — Revisão e gravação
- Match executado no cliente via server function `matchProfissionaisImport({ cpfs, matriculas })` usando `requireSupabaseAuth` (RLS da tabela `profissionais` aplicada). Retorna map CPF→id, matrícula→id.
- Ordem: CPF exato → matrícula exata → “não localizado”. (Fuzzy nome: fase 2.)
- Tabela de preview: cada linha mostra origem, destino (nome/matrícula do profissional casado ou “não localizado”), status colorido via `StatusBadge`.
- KPIs no topo: total lidos / a importar / divergências / não localizados.
- Botão “Confirmar importação” chama `commitImportPiso({ historico, linhas })` (server fn, `piso.importar`).

## 5. Server functions (`src/lib/piso-enfermagem.functions.ts`)

Todas com `requireSupabaseAuth` + guard de permissão explícito (`has_permission`).

- `matchProfissionais({ cpfs: string[], matriculas: string[] })` → busca em `profissionais` e devolve dois mapas.
- `commitImportPiso({ modelo, nomeArquivo, tipoArquivo, competencia, mapeamento, linhas })` → cria `historico_importacoes` + `insert` batch em `piso_enfermagem`, atualiza contadores, retorna `historico_id`. Transacional via RPC SQL `piso_import_commit` (SECURITY DEFINER) para garantir atomicidade.
- `listImportHistorico({ page, pageSize })` → paginação.
- `listImportLinhas({ historicoId, filtros })` → detalhe.
- `saveMapeamento({ nome, modelo, mapeamento })` / `listMapeamentos({ modelo })`.

## 6. Componentes (`src/components/piso/`)

- `ImportWizard.tsx` (stateful, orquestra 3 passos).
- `MappingGrid.tsx`.
- `PreviewTable.tsx`.
- `HistoricoImportacoesList.tsx`.

Reaproveita `PageHeader`, `KpiCard`, `DataTable`, `FilterBar`, `StatusBadge`, `FormDialog`, `EmptyState`, `useConfirm`, `logger`, `formatCurrency`, `formatCPF`, `formatDateTime`.

## 7. Testes

Novos testes Vitest:
- `src/lib/piso-mapping.test.ts` — heurística de auto-mapeamento (nomes normalizados).
- `src/lib/piso-import.test.ts` — parser de linhas + resolução de match (CPF/matrícula/não localizado) com mocks.

Meta: manter 80/80 anteriores verdes + 6–10 novos (~86–90 total).

## 8. Fora deste MVP (Fase 2 futura)

- PDF pesquisável (via `pdfjs-dist` client-side).
- Fuzzy nome (Levenshtein) com faixas 85%/60%.
- Desfazer importação (`status='Desfeito'` + delete das linhas).
- OCR — se autorizado, via Lovable AI (Gemini vision).
- Exportação Excel de divergências.

## Detalhes técnicos

- Sem alteração em tabelas existentes.
- Sem edge functions Supabase.
- Sem chamadas ao `supabaseAdmin` — todo o fluxo passa por `requireSupabaseAuth`+RLS.
- Sem dependências novas: `xlsx` e `zod` já presentes.
- Migration inclui `emit_evento` opcional? Não — o `emit_evento` guard só aceita agregados conhecidos; deixamos apenas `audit_log` via trigger `tg_audit_row` nas duas novas tabelas.
- `PermissionGate` aplicado em cada rota nova.
- Terminologia: rótulos “Competência” do módulo continuam “Competência” (é o rótulo real de folha, não “Período” global).

## Checklist final da fase

1. Migração aprovada e executada.
2. Tipos regenerados (`types.ts` atualiza sozinho).
3. Sidebar + rotas gated.
4. `bun run typecheck` limpo.
5. Testes verdes (`bunx vitest run`).
6. Relatório curto no fechamento.
