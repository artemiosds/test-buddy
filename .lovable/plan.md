# Frequência de Efetivos — Padrão AGILIBlue

Espelho fiel do PDF oficial da SEMSA para servidores estatutários, isolado da tela de Contratados. Compartilha apenas componentes atômicos de UI, sem misturar dados.

## 1. Banco de dados (migração)

Criar tabela dedicada `public.frequencias_efetivos`, uma linha por profissional/competência/unidade:

**Identificação e vínculo**
- `id`, `competencia_id`, `unidade_id`, `profissional_id` (único por competência+profissional)
- `secretaria_id` (denormalizado para RLS)
- `created_by`, `updated_by`, timestamps, `deleted_at`

**Metadados do vínculo (snapshot editável)**
- `proj` (int) — código do projeto
- `hp` (int) — horas projeto
- `ch` (int) — carga horária mensal
- `jorn` (int) — jornada

**Totalizadores**
- `dias_falta` (int)
- `att` (int) — atestado
- `mat` (int) — licença maternidade / afastamento

**Hora extra**
- `he_50` (numeric)
- `he_100` (numeric)

**Férias**
- `ferias_1_3` (bool) — gozo de 1/3
- `ferias_integ` (int) — integralização

**Variáveis**
- `sal_sub_h` (numeric) — salário substituição / hora
- `adic_not` (numeric) — adicional noturno
- `aulas_suple` (numeric) — aulas suplementares
- `plantao` (numeric)
- `sobreaviso` (numeric)
- `incentivo` (numeric)

**Controles**
- `licenca_premio` (int) — dias
- `observacoes` (text)
- `status` (`status_frequencia`: rascunho / enviada / aprovada / rejeitada / devolvida)

**Restrições e regras**
- `UNIQUE (competencia_id, profissional_id)`
- CHECKs de não-negativo em todos os numéricos
- Trigger `tg_set_updated_at` + `tg_set_updated_by`
- Trigger de auditoria `tg_audit_row`
- Índices por `(competencia_id, unidade_id)` e `(profissional_id)`

**RLS**
- GRANT para `authenticated` e `service_role`
- SELECT: usuário com `user_has_unit(unidade_id)` e permissão `frequencia.visualizar`
- INSERT/UPDATE: mesmas regras + `has_permission('frequencia.lancar')` e `status ∈ (rascunho, devolvida)`
- Análise (`aprovada`/`rejeitada`) apenas via server function com `has_permission('frequencia.aprovar')`

**Campos no cadastro do profissional (para snapshot)**
Adicionar em `public.profissionais`: `proj_codigo` (int), `hp` (int), `ch_mensal` (int), `jorn_mensal` (int). Ficam read-only na folha, servindo de fonte para pré-preenchimento.

## 2. Server functions (`src/lib/frequencias-efetivos.functions.ts`)

Padrão idêntico ao arquivo de contratados, com `requireSupabaseAuth` + `ensurePermission`:

- `listarFolhaEfetivos({ competenciaId, unidadeId })` — filtra profissionais da unidade com `natureza_vinculo = 'estatutario'`, faz LEFT JOIN com `frequencias_efetivos` para trazer linhas existentes e retorna "rascunhos virtuais" (zerados, com metadados do cadastro) para os que ainda não têm registro.
- `salvarFolhaEfetivos({ competenciaId, unidadeId, linhas[] })` — upsert em lote, valida não-negatividade, respeita competência ativa e status editável, emite evento `frequencia.salva`.
- `enviarFolhaEfetivos({ competenciaId, unidadeId })` — muda status `rascunho → enviada` de todas as linhas da unidade, emite `frequencia.enviada`.
- Reaproveita a UI de anexos existente (tabela `documentos`) para anexar atestados por profissional/competência.

## 3. Rotas e componentes

**Estrutura de rotas**
```text
/frequencias                          (mantida — index navega para efetivos/contratados)
/frequencias/efetivos                 (nova — folha AGILIBlue)
/frequencias/contratados              (renomeada — hoje é /frequencias-contratados)
```

- `src/routes/_authenticated/frequencias.index.tsx` — cards navegando para os dois módulos
- `src/routes/_authenticated/frequencias.efetivos.tsx` — nova tela
- `src/routes/_authenticated/frequencias.contratados.tsx` — mover conteúdo atual de `frequencias-contratados.tsx`
- Menu lateral atualizado: "Frequência de Efetivos" e "Frequência de Contratados" como itens separados

**Componentes atômicos compartilhados** (`src/components/frequencia/`)
- `CompetenciaSelect.tsx` — seletor padrão (default: competência ativa)
- `UnidadeSelect.tsx` — trava única para Diretor/Administrativo, dropdown para Gestor/Master
- `StatusBadge.tsx` — badge colorido por status
- `NumberCell.tsx` — célula numérica editável não-negativa com navegação por teclado
- `SwitchCell.tsx` — célula booleana (para `ferias_1_3`)
- `FolhaToolbar.tsx` — barra com "Salvar rascunho", "Enviar para aprovação", contador de status

## 4. Layout da tabela (padrão AGILIBlue)

Cabeçalho agrupado em blocos, uma linha por servidor:

```text
┌─ Identificação ─┬─ Vínculo (read-only) ─┬─── Totalizadores ───┬─ Hora extra ─┬── Férias ──┬────────────── Variáveis ──────────────┬─ Controles ─┐
│ Matr. │ Nome   │ Proj │ H.P │ C.H │ Jorn│ DIAS │ ATT │ MAT   │ 50% │ 100%  │ 1/3 │ Integ.│ Sal.Sub/H │ Adic.Not │ Aulas Suple│Plantão│S.Aviso│Incent.│ L.Prêmio │ Obs │ Status │
│ Cargo (linha 2 abaixo do nome, cinza claro)                                                                                                            │
```

- Coluna Identificação: nome em negrito, matrícula acima e cargo em fonte menor abaixo (bloco vertical)
- Vínculo: fundo cinza claro, `read-only`, alimentado do cadastro (`proj_codigo`, `hp`, `ch_mensal`, `jorn_mensal`)
- Blocos separados por bordas verticais mais escuras
- Rodapé fixo: total de servidores + status agregado (X rascunhos / Y enviadas / Z aprovadas)
- Densidade compacta (linha alta ~44px para caber os dois níveis da identificação)

## 5. Comportamento

- Ao abrir: carrega competência ativa + unidade do usuário (ou dropdown para Gestor/Master); server function retorna todos os servidores estatutários já como linhas (com rascunho virtual quando não existe registro).
- Edição inline sem modais, com navegação Tab/Enter/setas na planilha.
- Autosave desativado — usuário aciona "Salvar rascunho" (persiste sem trocar status) ou "Enviar para aprovação" (lote).
- Após envio ou fechamento da competência, linhas ficam somente-leitura visualmente e no servidor.
- Permissões:
  - `frequencia.lancar` — habilita edição
  - `frequencia.visualizar` — modo leitura
  - `frequencia.aprovar` — não aplicável nesta tela (fluxo continua em `/aprovacoes`)
- Anexos: botão de clipe por linha abre o dialog existente de documentos, tag automática `frequencia_efetivos:{profissional_id}:{competencia_id}`.

## 6. Segurança e isolamento

- Tela de Efetivos consome **exclusivamente** `frequencias_efetivos` + profissionais com `natureza_vinculo = 'estatutario'`.
- Tela de Contratados consome **exclusivamente** `frequencias_contratados` + profissionais com natureza ≠ `'estatutario'`.
- Nenhum SELECT cruzado entre as duas tabelas.
- Server functions validam a natureza do vínculo antes de aceitar upsert (defesa em profundidade).

## 7. Ordem de execução

1. Migração SQL (tabela + colunas em `profissionais` + índices + RLS + triggers).
2. Server functions de efetivos.
3. Componentes atômicos compartilhados.
4. Rota `frequencias.efetivos.tsx`.
5. Mover conteúdo atual para `frequencias.contratados.tsx` e ajustar rota.
6. Atualizar menu lateral.
7. Type-check e verificação de acessos.

## 8. Fora do escopo

- Fluxo de aprovação institucional (permanece em `/aprovacoes`, já funcional).
- Migração de dados históricos de `frequencia_profissional` (tabela antiga continua acessível por rotas legadas até ser desativada em fase futura).
- Push notifications e integrações externas (e-Social/SIOPS).
