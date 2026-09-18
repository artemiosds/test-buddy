# Notificações: diagnóstico e o que falta

## Resposta curta

As duas telas contam a mesma história por lados opostos: **"Notificações (Logs)" funciona**
porque registra o que o servidor enviou por e-mail (nova competência, profissional rejeitado);
a tela **Notificações aparece vazia** porque o aviso dentro do sistema é gravado por outro
caminho — e as fontes mais importantes desse caminho estão **falhando na gravação**.

Ou seja: o sistema avisa por e-mail, mas o mesmo fato não chega ao sino/lista. Não é um
problema de tela vazia por falta de uso: é aviso perdido na hora de salvar.

## Solução inteligente (a verdadeira correção)

Hoje cada rotina grava o aviso "na mão", cada uma com um valor de canal diferente — e duas
delas usam um valor inválido, o que faz o banco rejeitar a gravação silenciosamente. A
solução certa não é remendar caso a caso, e sim **um único ponto de entrada de avisos**:

1. **Uma função central de notificação** que todas as rotinas passam a usar (evento de
   pendência, competência, folha rejeitada, prazo, documento assinado, anexos). Ela valida
   canal/tipo/prioridade, grava o aviso no sistema, dispara o e-mail quando cabe e registra o
   resultado no mesmo log que hoje você já consegue ver.
2. **Nada de falha silenciosa:** se a gravação falhar, aparece no log de notificações e na
   Saúde do Sistema, com o motivo — não fica invisível como está hoje.
3. **Log unificado:** a tela "Notificações (Logs)" passa a mostrar também os avisos internos
   (não só e-mail), então as duas telas param de divergir e dá para auditar tudo num lugar.
4. Com isso, cada fato do sistema gera **um aviso no sino + um e-mail** consistentes,
   idempotentes (sem duplicar em reenvio) e rastreáveis.

## O que já funciona

- Sino no cabeçalho com contador de não lidas, atualizado em tempo real e a cada 5 minutos.
- Aviso do navegador (push local) quando a aba está em segundo plano.
- Tela `/notificacoes`: filtros (não lidas, todas, por tipo), marcar lida/não lida, marcar
  todas, excluir, badges de tipo e prioridade.
- Geradores que gravam corretamente: nova competência, folha rejeitada/devolvida,
  reenvio/auditoria de anexos, além do e-mail SMTP com log em "Notificações (Logs)".
- Assistente HSM consegue listar avisos não lidos e marcar todos como lidos.

## Problemas encontrados (no código)

1. **Canal inválido no processador de eventos — avisos perdidos.**
   `src/routes/api/public/hooks/eventos-worker.ts:61` grava `canal: "in_app"`, mas os valores
   aceitos são `interno`, `email`, `sms`, `push`. Toda a família de avisos que passa pela fila
   de eventos falha na gravação: **pendências** (criada, atribuída, respondida, resolvida,
   reaberta, prazo vencido/próximo, escalonada), **competência aprovada/rejeitada** e
   **documento totalmente assinado**. Além de não notificar, o evento é marcado como falha e
   entra em retentativa.

2. **Canal inválido no aviso de prazo.**
   `src/routes/api/public/hooks/deadline-check.ts:88` e `:105` gravam `canal: "sistema"`,
   também fora da lista aceita. Os avisos de "prazo de envio próximo" e "prazo vencido" não
   são criados; o erro é ignorado silenciosamente e a rotina reporta zero.

3. **E-mail do processador aponta para tabela inexistente.**
   No mesmo processador, o disparo de e-mail busca endereços em `profiles`
   (`eventos-worker.ts:96`), tabela que não existe no projeto — os usuários estão em
   `usuarios`. O erro é engolido pelo `try/catch`, então nenhum e-mail sai por essa via
   (mesmo se o canal fosse corrigido).

4. **Botão "Abrir" pode não navegar.**
   A tela usa o link salvo no aviso diretamente (`notificacoes.tsx:219`), e vários geradores
   salvam links com parâmetro, como `/pendencias?id=...`. O caminho e o parâmetro precisam ser
   separados; hoje o comportamento desses links precisa ser verificado antes de considerar a
   navegação confiável.

5. **Falhas de gravação são invisíveis.** Nenhum gerador de aviso in-app registra erro em
   lugar visível (o log de "Notificações" só cobre e-mail). Foi exatamente assim que os
   itens 1 e 2 passaram despercebidos.

6. **Lacunas de uso na tela:** sem atualização automática da lista (só o contador do sino
   atualiza em tempo real), sem filtro por prioridade/período, sem busca por texto, sem
   seleção múltipla para excluir/marcar, sem paginação (limite fixo de 200), sem exportação,
   e sem nenhuma tela de preferências (o usuário não escolhe o que quer receber por e-mail).

7. **Campos ociosos:** `enviada` / `enviada_em` existem na tabela mas nunca são usados, então
   não é possível distinguir "avisado no sistema" de "avisado por e-mail".

## Correção proposta

### Etapa 1 — Ponto único de notificação e fim dos avisos perdidos (essencial)
- Criar a função central de notificação (valida canal/tipo/prioridade, grava o aviso interno,
  dispara e-mail quando cabe, registra no log) e migrar todas as rotinas para ela — inclusive
  o processador de eventos e o verificador de prazos, que hoje usam canal inválido
  (`in_app` e `sistema`).
- Corrigir a busca de e-mails para a tabela `usuarios` (ativos, sem exclusão), reaproveitando
  o modelo de e-mail e o log já usados nas rotinas que funcionam.
- Fazer as falhas aparecerem no log de notificações e na Saúde do Sistema, com motivo.
- Passar a registrar também os avisos internos no log, para as duas telas contarem a mesma
  história.
- Reprocessar a fila de eventos pendentes, entregando os avisos que ficaram travados.

### Etapa 2 — Navegação e conteúdo confiáveis
- Separar caminho e parâmetros ao abrir um aviso; se o link não for reconhecido, abrir a tela
  correspondente sem quebrar a navegação.
- Padronizar os links gerados (pendência, competência, folha, documento) em um único formato.

### Etapa 3 — Tela de notificações completa
- Atualização em tempo real da própria lista (mesmo canal já usado pelo sino).
- Filtros por prioridade e período + busca por título/mensagem.
- Seleção múltipla: marcar lidas e excluir em lote; paginação em vez do limite de 200.
- Exportação em Excel e PDF no padrão ABNT, como nos demais painéis.
- Marcar `enviada`/`enviada_em` quando houver e-mail, e exibir na linha se o aviso também
  foi enviado por e-mail.

### Etapa 4 — Preferências por usuário
- Tela simples de preferências: por tipo de evento, escolher receber no sistema, por e-mail
  ou ambos; os geradores passam a respeitar essa escolha (padrão: tudo ligado).

## Detalhes técnicos

- Enum aceito: `canal_notificacao` = `interno | email | sms | push`;
  `tipo_notificacao` = `info, sucesso, alerta, erro, pendencia, aprovacao, sistema`.
- Geradores in-app: `eventos-worker.ts` (fila `eventos_dominio` via `claim/ack/nack`),
  `deadline-check.ts`, `notificar-competencia.server.ts`, `notificar-rejeicao.server.ts`,
  `auditoria-anexos.server.ts`, `reenvio-anexos.functions.ts`.
- Contador do sino: `src/routes/_authenticated.tsx:380` (consulta) e `:428` (tempo real).
- Tela: `src/routes/_authenticated/notificacoes.tsx`; logs de e-mail:
  `logs-notificacoes.functions.ts` + `/relatorio-notificacoes`.
- Nenhuma alteração de esquema é necessária nas etapas 1 a 3; a Etapa 4 exige uma tabela
  nova de preferências.

## Verificação

1. Criar/atribuir uma pendência e confirmar que o responsável recebe o aviso no sino.
2. Rodar o verificador de prazos e confirmar avisos de "prazo próximo" e "prazo vencido".
3. Aprovar/rejeitar uma competência e conferir o aviso do responsável da unidade.
4. Abrir um aviso pelo botão "Abrir" e confirmar que a tela correta é carregada.
5. Conferir na fila de eventos que não restam eventos em falha após o reprocessamento.
