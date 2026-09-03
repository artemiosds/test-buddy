# Edição restrita a linhas rejeitadas/devolvidas + cores de status + notificação de rejeição

## Objetivo

1. O Diretor de Unidade só pode editar e reenviar a folha (Efetivos e Contratados) nas linhas cujo status esteja **Rejeitada** ou **Devolvida para correção**. Linhas pendentes, enviadas, em análise ou aprovadas ficam bloqueadas.
2. Melhorar a cor/legibilidade dos badges de status na grade das folhas.
3. Sempre notificar os responsáveis da unidade (notificação no sistema + e-mail) quando algo da folha for rejeitado — tanto a folha inteira quanto uma linha individual de profissional.

## Situação atual (verificada no código)

- **Contratados** já aplica a regra por linha: a linha só é editável quando o status é rascunho, rejeitada ou devolvida.
- **Efetivos** ainda não: a grade só bloqueia a linha quando ela está `aprovada`; enquanto a folha está enviada/em análise, o diretor consegue digitar em linhas pendentes.
- Rejeição da **folha** dispara apenas e-mail para o criador da folha; não gera notificação no sino do sistema.
- Rejeição de uma **linha individual** (tela de Aprovações) não dispara nenhuma notificação nem e-mail.
- Na grade de Efetivos o status da linha é exibido num badge cinza genérico, sem cor por estado.

## O que será feito

### 1. Regra de edição por linha (Efetivos)

Aplicar na folha de Efetivos a mesma regra já usada em Contratados:

- **REGRA DE OURO:** o status da linha sempre se sobrepõe ao status geral da folha. Se a linha do profissional estiver `rejeitada` ou `devolvida`, ela permanece **editável** para o Diretor de Unidade mesmo que a folha esteja `enviada`, `em análise` ou `aprovada`. O Diretor nunca é impedido de corrigir um profissional rejeitado.
- Fora desse caso, a linha é editável quando a folha está em rascunho/com pendências/devolvida/rejeitada.
- Linha `aprovada` ou `pendente` dentro de folha enviada/em análise/aprovada: somente leitura.
- Perfis Gestor/Master mantêm o bypass de edição já existente.
- O botão "Enviar/Reenviar correções" fica habilitado sempre que existir ao menos uma linha corrigível (rejeitada/devolvida), mesmo com a folha em análise ou aprovada; nesse caso o reenvio abrange apenas as linhas corrigidas.

### 2. Reforço no servidor

Nas funções de salvamento e envio das duas folhas, aplicar a mesma precedência: aceitar gravação quando a linha estiver em estado corrigível (rascunho, rejeitada, devolvida) **independentemente do status da folha**, e recusar apenas linhas aprovadas/pendentes de folha já enviada (mantendo o bypass Master/Gestor). Assim a regra não depende só da interface.


### 3. Cores de status

- Ajustar o registro central de status (`src/lib/status.ts`) para dar cores mais claras e contrastantes a `rejeitada` (vermelho), `devolvida` (âmbar), `aprovada` (verde), `em_analise` (azul) e `pendente/rascunho` (neutro).
- Na grade de Efetivos, trocar o badge genérico pelo `StatusBadge` padronizado, igual ao de Contratados, e destacar visualmente a linha rejeitada (fundo suave vermelho) para o diretor localizar rapidamente o que corrigir.

### 4. Notificações de rejeição

Criar um utilitário de servidor que, a cada rejeição/devolução:

- Identifica os destinatários: diretores/usuários vinculados à unidade da folha (mais o criador da folha).
- Insere notificação no sistema (tabela `notificacoes`, tipo alerta, com link direto para a folha correspondente).
- Envia e-mail com a justificativa, reaproveitando o template e o SMTP já configurados.

Pontos de disparo:

- Rejeição/devolução da folha inteira (fluxo de alteração de status já existente) — passa a gerar também notificação no sino, além do e-mail atual.
- Rejeição de linha individual na tela de Aprovações — passa a gerar notificação + e-mail citando o profissional e o motivo informado.

A justificativa continua obrigatória para rejeitar/devolver, e será incluída na mensagem.

## Detalhes técnicos

- Arquivos afetados: `src/components/frequencias/frequencias-efetivos-page.tsx`, `src/components/frequencias/frequencias-contratados-page.tsx` (destaque visual), `src/lib/status.ts`, `src/lib/frequencias.functions.ts`, `src/lib/frequencias-efetivos.functions.ts`, `src/lib/frequencias-contratados.functions.ts`, `src/routes/_authenticated/aprovacoes.tsx`, e um novo `src/lib/notificar-rejeicao.server.ts`.
- Sem alteração de schema: usa as tabelas `notificacoes` e `logs_notificacoes` existentes.
- O envio de e-mail permanece tolerante a falhas (erro de SMTP não bloqueia a ação de rejeitar).
