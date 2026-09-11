# Fim das pendências fantasmas: banco só para contratados e setor opcional

Hoje o sistema marca como irregular quem não tem banco/agência/conta e quem não tem setor, mesmo quando isso é normal. Vamos ajustar as regras.

## O que muda

1. **Dados bancários só valem para contratados/prestadores**
   - "Sem banco", "Sem agência" e "Sem conta corrente" deixam de aparecer para servidores efetivos (e estatutários), em telas, badges, conferência de folha e relatórios.
   - Para contratados, comissionados e terceirizados a checagem continua igual.

2. **Setor passa a ser opcional**
   - Ter a unidade (lotação) já torna o cadastro regular.
   - Sai o indicador "Lotação (setor)" da nota de integridade, o alerta "Profissionais sem setor" do painel de força de trabalho e o contador de "Sem setor" como achado negativo nos relatórios executivos.
   - O agrupamento por setor continua existindo como informação (tabelas e distribuição por setor), apenas não é mais erro.

3. **Nota de qualidade recalculada**
   - A pontuação de integridade e a conferência de folha passam a considerar apenas campos aplicáveis, sem rebaixar o município por campo que não se aplica.

## Detalhes técnicos

- `src/lib/situacao-funcional.ts`
  - `ProfConferencia` recebe `vinculo_natureza?: string | null`.
  - Novo helper `ehEfetivo(p)` (casa `efetiv`/`estatut` em `vinculo_natureza` ou `vinculo`, mesma lógica de `classificarVinculo` em `geral-cargos.ts`).
  - `derivarAlertas`: os três alertas bancários só são emitidos quando `!ehEfetivo(p)`. A regra de `sem_lotacao` (já baseada em unidade) permanece.
  - `derivarElegibilidadePiso` e `contarSituacoes` herdam automaticamente a nova lista de alertas.
- `src/hooks/use-conferencia.ts`: incluir `vinculo_id, vinculos(nome, natureza)` no select e preencher `vinculo`/`vinculo_natureza` no mapa, para que os componentes já saibam o vínculo.
- `src/components/shared/gerencial/index.tsx` e `src/components/erp-grid/index.tsx`: nada de lógica nova — passam a exibir só os alertas que sobram.
- `src/lib/relatorios-gerenciais-intelligence.ts`: remover a métrica `setor` do array de integridade, ajustar as fatias (`slice`) de `integridadeCadastral`/`lotacao` para o novo tamanho (lotação passa a considerar unidade + cargo), remover `semSetor` de `pendencias`, do tipo exportado e do achado/alerta correspondente.
- `src/lib/workforce-alerts.ts` (+ `workforce-alerts.test.ts`): remover o alerta `prof-sem-setor` e o campo `semSetor` do tipo.
- `src/lib/intelligence.ts` e `src/hooks/use-intelligence.ts`: remover `semSetor` do cálculo de "sem lotação" e do rótulo "Sem setor".
- `src/lib/workforce-filters.ts` / rotas que usam `integridade: "sem-setor"`: remover a opção do filtro se existir.
- `src/components/frequencias/frequencias-contratados-page.tsx`: mantém a checagem bancária (é tela de contratados), sem mudanças.
- `src/lib/situacao-funcional.test.ts`: ajustar/estender casos para efetivo sem banco = sem alerta.
- Validação: `bunx tsgo --noEmit` e `bunx vitest run` nos testes tocados.

## Fora do escopo

- Campos bancários no formulário de cadastro continuam disponíveis para todos.
- Nenhuma mudança de banco de dados.
