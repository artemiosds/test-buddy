# Relatório: notificações de nova competência (in-app, mural e e-mail)

## O que foi verificado no banco e no código

- **E-mail SMTP: funcionando.** `logs_notificacoes` tem 13 registros, todos com status
  `enviado` e nenhum `erro`: 1 teste SMTP e 12 e-mails "[Aviso] Nova Competência
  Aberta: 09/2026" para 12 destinatários distintos, em 25/08/2026 19:35 UTC.
- **Cobertura dos destinatários: correta.** Existem 14 usuários ativos e todos têm
  e-mail válido; os 12 notificados são os vinculados às unidades ativas da secretaria
  daquela competência (os 2 restantes não têm vínculo/acesso amplo nessa secretaria).
- **Fluxo automático: já está ligado.** `criarCompetencia`
  (`src/lib/competencias.functions.ts`) chama `notificarNovaCompetencia` dentro de um
  `try/catch`, então toda nova competência dispara in-app + mural + e-mail.

## Problemas encontrados

1. **Duplicação causada pelo reenvio.** A competência 09/2026 tem **24 notificações
   in-app** para 12 usuários (2 por pessoa) e **2 avisos no mural** com o mesmo título.
   `notificarNovaCompetencia` não é idempotente: sempre insere notificações e um novo
   aviso, mesmo quando já existem. Só o e-mail não duplicou porque o primeiro disparo
   falhou por falta de SMTP.
2. **Rota pública sem autenticação.** `src/routes/api/public/reenviar-notificacoes-competencia.ts`
   está sob `/api/public/*` (sem login), aceita qualquer `competencia_id` e usa o
   cliente service-role. Qualquer pessoa na internet pode disparar e-mails em massa.
   Já existe a alternativa segura: `reenviarNotificacoesCompetencia`
   (`src/lib/notificar-competencia.functions.ts`), protegida por login + MASTER.
3. **Falha de e-mail fica silenciosa.** Se o SMTP cair, `criarCompetencia` apenas
   registra no console; a tela informa sucesso e ninguém percebe que os diretores não
   foram avisados. Foi exatamente o que aconteceu em 09/2026.

## Correções propostas

### 1. Remover a rota pública de reenvio
Excluir `src/routes/api/public/reenviar-notificacoes-competencia.ts`. O reenvio
continua disponível pela função autenticada existente.

### 2. Tornar o reenvio idempotente (`src/lib/notificar-competencia.server.ts`)
- Antes de inserir notificações, buscar em `notificacoes` quem já recebeu
  (`entidade_tipo='competencia'` + `entidade_id`) e inserir só para os que faltam.
- Antes de criar o aviso do mural, procurar aviso ativo com o mesmo título/competência;
  se existir, atualizar prazos em vez de criar outro.
- Antes de enviar e-mail, checar `logs_notificacoes` por destinatário + assunto já com
  status `enviado`, pulando quem já recebeu. Retornar contadores separados
  (novos vs. já existentes) para a tela mostrar o resultado real.

### 3. Tornar visível a falha de e-mail
Fazer `notificarNovaCompetencia` retornar também as falhas, e `criarCompetencia`
devolver esse resumo para a UI exibir um aviso ("competência criada, mas N e-mails
falharam") em vez de sucesso silencioso.

### 4. Limpeza dos dados duplicados de 09/2026
Remover as 12 notificações in-app duplicadas (mantendo a mais antiga por usuário) e o
aviso de mural repetido, via operação pontual de dados.

## Observações técnicas

- Idempotência do e-mail se apoia em `logs_notificacoes` (`destinatario`, `assunto`,
  `status`, `data_envio`); não é preciso alterar o esquema.
- Nenhuma migração de banco é necessária.

## Verificação

1. Reenviar a competência 09/2026 pela ação autenticada e confirmar que nada novo é
   criado (contadores de "já enviados").
2. Criar uma competência de teste e conferir 1 notificação por usuário, 1 aviso e 1
   e-mail por destinatário em `logs_notificacoes`.
3. Conferir que `/api/public/reenviar-notificacoes-competencia` passa a retornar 404.
