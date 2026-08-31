# Retenção permanente dos documentos anexados (R2 com bloqueio indefinido)

Objetivo: nenhum binário de anexo vinculado a submissão pode ser apagado pelo sistema — em nenhum status. Remoção passa a ser apenas lógica (soft delete), o erro de retenção do R2 é tratado explicitamente, e uma auditoria diária avisa o Master se algum binário sumir.

## 1. Fim da exclusão física automática no R2

Hoje existem quatro caminhos que chamam DELETE no R2:

- `descartarAnexosPendentes` (cancelamento do modal "Enviar folha") — apaga registro e binário.
- Cron `/api/public/hooks/purgar-documentos` — apaga binário após `purga_apos`.
- Tela `/frequencias/$id` — remoção de anexo chama `removerArquivoUniversal`.
- `validarObjeto` — apaga o objeto quando o upload excede o limite ou vem vazio.

Mudança: a função de exclusão no R2 deixa de ser chamada por qualquer fluxo automático. Ela permanece no código apenas para o ciclo de teste do diagnóstico (arquivo descartável em `diagnostico/`), e passa a registrar o resultado sem quebrar nada quando o bucket recusar.

- `descartarAnexosPendentes`: passa a fazer soft delete (`deleted_at`, `deleted_by`, motivo `envio_cancelado`) — nunca `DELETE` de linha nem de objeto.
- Cron de purga: deixa de apagar binários no R2. Continua apenas marcando `metadata.retido_r2 = true` para registros vencidos, mantendo o rastro de auditoria. (O caminho legado do Supabase Storage segue disponível apenas para arquivos que nunca foram para o R2; se preferir, também posso congelar esse caminho — diga na aprovação.)
- Tela `/frequencias/$id`: remoção de anexo passa a usar o soft delete do servidor, sem tocar no storage.
- `validarObjeto`: em caso de arquivo vazio/acima do limite, apenas rejeita o upload e registra log — não tenta apagar.

## 2. Soft delete como único mecanismo

Todos os pontos de "remover anexo" da interface passam pelo mesmo caminho: marcar `deleted_at` no banco. O item some da lista ativa, continua na lixeira/histórico e o binário permanece intacto no R2 para consulta permanente.

## 3. Tratamento do erro de retenção do R2

Na camada de storage, respostas de bloqueio (403 / `AccessDenied` / `ObjectLockRetention` / `InvalidRequest` de retenção) passam a ser identificadas e devolvidas como um resultado tipado `{ ok: false, motivo: "retencao" }`:

- registrado em log com a chave do objeto e o código HTTP;
- nunca contado como sucesso;
- nunca propagado como erro cru para o usuário — a interface mostra uma mensagem clara ("o arquivo é retido por política de armazenamento") quando isso puder ocorrer.

O painel de diagnóstico do R2 passa a tratar a etapa de limpeza como "retido pelo bucket lock" em vez de falha vermelha.

## 4. Auditoria automática diária

Nova rota de cron `/api/public/hooks/auditar-anexos` (mesmo padrão de autenticação `x-cron-secret` das rotas existentes):

- varre todos os documentos ativos (`deleted_at` nulo) com caminho `r2:` vinculados a frequência/submissão;
- faz HEAD em cada objeto;
- se encontrar ausentes: cria notificação in-app de prioridade alta para cada usuário Master e envia e-mail pelo mesmo remetente SMTP já configurado, listando nome do documento, submissão, unidade e autor;
- devolve um resumo (`verificados`, `ausentes`) e registra evento de auditoria;
- sem ausentes, não notifica ninguém.

Agendamento diário via pg_cron apontando para a URL estável do projeto.

## 5. Retenção visível em Aprovações e histórico

A listagem de Documentos Comprobatórios já filtra apenas por entidade e `deleted_at`, sem depender do status da submissão. Vou confirmar em Aprovações que, com a folha aprovada e reprovada, os anexos continuam listados com link assinado funcionando, e ajustar caso alguma tela esconda a seção fora do estado pendente.

## Detalhes técnicos

Arquivos afetados: `src/lib/storage-r2.server.ts`, `src/lib/storage-r2.functions.ts`, `src/lib/storage-universal.ts`, `src/lib/frequencias.functions.ts`, `src/routes/api/public/hooks/purgar-documentos.ts`, `src/routes/_authenticated/frequencias_.$id.tsx`, `src/lib/diagnostico-r2.functions.ts`, `src/components/aprovacoes/UploadAnexoModal.tsx` (mensagens), além dos novos `src/lib/auditoria-anexos.server.ts` e `src/routes/api/public/hooks/auditar-anexos.ts`.

Sem migração de banco: `deleted_at`, `deleted_by`, `purga_apos` e `metadata` já existem em `documentos`.
