# Correção: reenvio de e-mail no Mural de Avisos

## Problema

A ação "Reenviar por e-mail" chama a server function `reenviarEmailAviso`, mas ela apenas repassa a chamada para a Edge Function `notificar-aviso-mural`. Essa Edge Function roda fora da aplicação e não conhece as credenciais SMTP salvas na nova tabela `configuracoes_sistema` — por isso retorna erro não-2xx e a interface mostra a mensagem genérica.

## Solução

Trazer o envio para dentro da aplicação, usando o mesmo helper de e-mail já usado nas notificações de competência (que lê as credenciais do banco e cai para variáveis de ambiente).

### 1. Novo módulo de envio (`src/lib/mural-avisos.server.ts`)

- Função `enviarEmailsAviso(avisoId)` que:
  - carrega o aviso (título, subtítulo, mensagem, tipo, prioridade, datas);
  - resolve os destinatários conforme `destinatarios` do aviso: `todos` (usuários ativos com e-mail válido), `perfis` (filtra pelo código do perfil) ou `unidades` (via `usuario_unidades`);
  - monta o e-mail com `generateEmailTemplate` e envia com `sendEmail` de `src/lib/email.server.ts` (credenciais vindas de `public.configuracoes_sistema` via service_role, com fallback para env);
  - retorna `{ enviados, falhas, destinatarios, motivo }` — incluindo o motivo quando o SMTP está desativado/incompleto.

### 2. `reenviarEmailAviso` (`src/lib/mural-avisos.functions.ts`)

- Remover o `supabase.functions.invoke('notificar-aviso-mural', ...)` e chamar `enviarEmailsAviso`.
- Erros deixam de ser objetos vazios: se não houver destinatários, ou se o SMTP estiver desativado/incompleto, ou se todos os envios falharem, a função lança/retorna mensagem descritiva.
- Só marcar `email_enviado_em` quando ao menos um e-mail for enviado com sucesso.
- Retorno de sucesso: `{ success: true, enviados, falhas, destinatarios }`.

### 3. `criarAviso` — mesmo caminho

- Trocar também o `invoke` da criação com `notificar_email` pelo novo helper, para que aviso novo e reenvio usem exatamente o mesmo fluxo.

### 4. Interface (`src/components/mural/MuralAvisosList.tsx`)

- No `onSuccess`, mostrar quantos e-mails foram enviados (e alertar quando houver falhas parciais).
- No `onError`, exibir a mensagem real retornada pelo servidor no toast, em vez do texto genérico da Edge Function.

## Observações técnicas

- A Edge Function `supabase/functions/notificar-aviso-mural` deixa de ser usada pela aplicação; posso removê-la ou mantê-la desativada — indique a preferência (por padrão vou mantê-la no repositório sem uso).
- Sem mudanças de banco de dados.
