# Pendências Institucionais — diagnóstico e o que falta

## Resposta curta

A página existe, tem menu, permissão e todo o ciclo de tratamento (atribuir, responder, resolver, reabrir, cancelar, prioridade, prazo, histórico e notificações). **Mas ela está fora do fluxo do sistema**: hoje nada cria pendências, então a tela tende a ficar sempre vazia.

## O que já funciona

- Item "Pendências" no menu, protegido pela permissão `pendencia.gerenciar`, com contador de badge.
- Lista com busca por título e filtros de status, categoria e prioridade; cartões de Total / Abertas / Em análise / Resolvidas.
- Painel lateral por pendência: histórico completo, troca de responsável, resposta, resolução, reabertura, cancelamento, prioridade e prazo.
- Cada ação grava histórico, emite evento e o processador de eventos gera notificação no sistema e e-mail para responsável e autor.

## O que está faltando

1. **Nenhuma forma de abrir uma pendência.** A rotina de criação existe no servidor, mas não há botão "Nova pendência" na tela e nenhum outro módulo a chama. Sem isso o módulo nunca recebe registro.
2. **Nenhuma abertura automática.** Nada nas frequências, aprovações ou nas rotinas agendadas cria pendência: reprovação/devolução de folha, prazo de envio vencido e documentos com problema não viram pendência.
3. **Duas contagens diferentes com o mesmo nome.** O contador do menu e os painéis/relatórios contam de uma tabela antiga de pendências de frequência, enquanto a página lê a tabela institucional. Os números não conversam entre si.
4. **Filtros incompletos.** Não há filtro por unidade, responsável nem por "atrasadas/vencendo", embora o servidor já aceite unidade e responsável; prioridade é filtrada só sobre as 200 primeiras linhas trazidas.
5. **Sem alerta de prazo.** O sistema já sabe avisar "prazo vencido", "prazo próximo" e "pendência escalonada", mas nenhuma rotina dispara esses avisos — a regra de 7 dias nunca é aplicada às pendências institucionais.
6. **Sem anexos.** A categoria "Documento" existe, mas não é possível anexar comprovantes na pendência nem na resposta.
7. **Lista limitada a 200 registros, sem paginação e sem exportação** (Excel/PDF), diferente dos outros painéis do sistema.

## Proposta de correção (em ordem)

**Etapa 1 — colocar no fluxo (essencial)**
- Botão "Nova pendência" na página, com formulário: título, descrição, categoria, prioridade, secretaria/unidade, responsável e prazo; visível somente para quem tem permissão de criar.
- Abertura automática nos pontos de origem: folha reprovada/devolvida em Aprovações e prazo de envio vencido, sempre vinculada à unidade/competência de origem e sem duplicar pendência já aberta para o mesmo caso.

**Etapa 2 — números coerentes**
- Unificar a contagem: badge do menu, painéis e relatórios passam a somar as pendências institucionais abertas/reabertas/atrasadas da mesma fonte da página.

**Etapa 3 — operação do dia a dia**
- Filtros por unidade e responsável (aplicados no servidor) e atalho "Somente atrasadas".
- Paginação e exportação em Excel e PDF no padrão ABNT usado nos outros painéis.
- Marcação automática de atraso segundo a regra de 7 dias e aviso ao responsável quando o prazo vencer.

**Etapa 4 — anexos**
- Anexar arquivos à pendência e à resposta, reaproveitando o armazenamento já usado pelas folhas.

## Detalhes técnicos

- Tela: `src/routes/_authenticated/pendencias.tsx`; regras: `src/lib/pendencias.functions.ts` (tabelas `pendencias`, `pendencia_historico`, RPC `proximo_numero_pendencia`).
- `criarPendencia` já existe e não tem nenhum chamador — é a lacuna central.
- Divergência de contagem: `src/routes/_authenticated.tsx:401` e `src/hooks/use-analytics.ts:182` leem `frequencia_pendencias`; a página lê `pendencias`.
- Notificações/e-mail já tratadas em `src/routes/api/public/hooks/eventos-worker.ts` (`handlePendencia`) via eventos de domínio.
- SLA definido em `src/config/sla-rules.ts` (`pendenciaDiasCritico: 7`) sem uso efetivo no módulo.
- Ganchos de automação candidatos: `src/routes/_authenticated/aprovacoes.tsx` / `src/lib/aprovacoes.functions.ts`, `src/lib/prazo-envio.ts` e o hook agendado `src/routes/api/public/hooks/deadline-check.ts`.
