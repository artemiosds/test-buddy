# Notificações automáticas de prazo de competência

## Fluxo implementado

- Depois de aplicada a migration, a abertura da competência aciona o sino, o mural e o e-mail.
- Lembretes de 3 dias, 1 dia e 1 hora consideram o corte às 23:59:59 (UTC-3).
- No vencimento, gestores institucionais são avisados; diretores só recebem o alerta se ainda houver folhas pendentes nas unidades vinculadas.
- O vencimento do prazo gera avisos e pendências, **sem encerrar a competência**. O encerramento é exclusivamente manual, pelo gestor autorizado no módulo Competências, com revisão das folhas pendentes e justificativa quando necessária. Competências `encerrada` ou `arquivada` não são encerradas novamente pelo cron.
- Uma outbox por evento/canal/destinatário protege contra concorrência e retenta e-mails falhos.

## 1. Aplicar migration no Supabase correto

Aplicar `supabase/migrations/20261103010000_deadline_notification_delivery_outbox.sql` no mesmo projeto Supabase usado pela aplicação.

A tabela tem RLS habilitado, sem acesso para `anon` e `authenticated`; somente o papel `service_role` possui grants. A função RPC de reserva também só pode ser executada por `service_role`.

A aplicação falha de forma segura para eventos idempotentes enquanto essa migration não estiver aplicada: o cron responde HTTP 503 e novas notificações com chave de evento não são disparadas. Aplique a migration antes de publicar/ativar o novo fluxo.

## 2. Configurar variáveis server-side da aplicação

| Variável | Finalidade |
| --- | --- |
| `SUPABASE_URL` | URL do projeto Supabase da aplicação |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave administrativa/secret do mesmo projeto |

O cliente Supabase do frontend no repositório atualmente aponta para o projeto `aybbfciidtdbhieordqw`. Portanto, enquanto esse cliente não for regenerado para outro projeto, configure `SUPABASE_URL=https://aybbfciidtdbhieordqw.supabase.co` e aplique a migration exatamente nesse mesmo projeto. A chave `SUPABASE_SERVICE_ROLE_KEY` deve ser gerada para esse projeto. Não aplique a migration em outro projeto Supabase conectado à sua conta.
| `DEADLINE_CRON_SECRET` | Segredo aleatório com ao menos 16 caracteres; use 32+ |
| `SMTP_HOST` | Servidor SMTP, se não usar o painel |
| `SMTP_PORT` | Porta SMTP |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASSWORD` | Senha SMTP — somente server-side |
| `SMTP_FROM` | Remetente |
| `SMTP_FROM_NAME` | Nome do remetente |

O SMTP também pode ser configurado pelo painel Configurações do Sistema. Não use variáveis `VITE_SMTP_*`: variáveis com esse prefixo podem ser incorporadas ao bundle do navegador.

## 3. Cadastrar segredos no GitHub

No repositório, abra **Settings → Secrets and variables → Actions** e cadastre:

- `DEADLINE_CHECK_URL`: URL HTTPS completa, por exemplo `https://SEU_DOMINIO/api/public/hooks/deadline-check`.
- `DEADLINE_CRON_SECRET`: exatamente o mesmo segredo configurado no ambiente server-side.

Não inclua segredo no arquivo YAML, no código ou em commits.

## 4. Ativar e testar

O workflow `.github/workflows/deadline-check.yml` executa a cada 15 minutos e permite execução manual pela aba **Actions**.

Depois de cadastrar ambos os segredos:
1. Abra **Actions → Verificar prazos de competências**.
2. Clique em **Run workflow**.
3. Confira a resposta JSON, com `ok: true`, `ledger_disponivel: true` e sem falhas.

O agendamento do GitHub Actions usa UTC e pode ter atraso operacional; o intervalo de 15 minutos reduz a janela de verificação sem prometer precisão de relógio.

## 5. Diagnóstico

- HTTP 503: segredo ausente ou menor que 16 caracteres no servidor.
- HTTP 401: segredo do workflow diferente do segredo de produção.
- HTTP 500: conferir variáveis Supabase e logs do servidor.
- `ledger_disponivel: false`: a migration ainda não foi aplicada no banco da aplicação.
- Falhas SMTP: conferir host, porta, autenticação, remetente e certificado TLS; a outbox preserva a tentativa e permite retentativa.
