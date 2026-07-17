# Runbook de Incidentes

_Última atualização: Sublote 8E · Onda 8_

Guia operacional para resposta a incidentes no sistema. Todas as ações
abaixo pressupõem acesso ao painel **`/saude`** (restrito a usuários
MASTER) e ao SQL Editor do Supabase.

> Painel: `/saude` · Auditoria: tabela `public.audit_log` · Logs de worker: dashboard Lovable.

---

## 1. Alertas VERMELHOS (críticos)

### 1.1 Eventos em falha definitiva (`eventos.falhou`)

1. Abrir `/saude` → seção **Eventos travados**.
2. Identificar o(s) evento(s) com status `falhou`.
3. Ler o campo **Último erro** — decidir:
   - Erro transitório resolvido (ex.: dependência voltou): clicar **Reprocessar**.
   - Erro permanente (payload inválido, agregado inexistente): clicar **Descartar** e informar motivo.
4. Auditar: cada ação grava em `audit_log` com operação `custom` e ação
   `evento.reprocessar` / `evento.descartar`.

### 1.2 SLA vencido (`sla.vencidas`)

1. Abrir `/pendencias` → filtrar por status abertos e ordenar por prazo.
2. Escalonamento automático já promoveu a prioridade — priorizar pelos
   status `alta`/`critica`.
3. Atribuir responsável e responder / encaminhar conforme fluxo da
   secretaria.

### 1.3 Evento pendente há ≥6h (`eventos.mais_antigo`)

1. Verificar se algum worker está consumindo:
   ```sql
   SELECT worker_id, count(*) FROM public.eventos_dominio
   WHERE status = 'processando' GROUP BY 1;
   ```
2. Se nenhum worker aparece: o consumidor externo pode ter caído —
   reiniciar o processo/edge function que chama `claim_eventos_dominio`.
3. Após reinício, monitorar `/saude` por 2 minutos: o backlog deve começar
   a cair.

### 1.4 Disjuntor aberto (`breakers.abertos`)

1. Localizar o RPC no card **Disjuntores de RPC** (`/saude`).
2. Investigar causa (últimos erros no worker log, timeout de rede, quota).
3. Depois de resolver a causa raiz, clicar **Forçar reset** naquele
   breaker — a ação:
   - zera contador de falhas,
   - fecha o circuito imediatamente,
   - registra `circuit_breaker.reset` em `audit_log`,
   - é limitada a 1 vez a cada 5 minutos por breaker (client-side).
4. Se o circuito reabrir em seguida, **não resetar de novo** — a causa
   raiz não foi resolvida; escalar.

---

## 2. Alertas ÂMBAR (warning)

### 2.1 Retry alto (`eventos.retry_alto`)

- Consultar os 5 tipos que mais falham no card **Top falhas por tipo**.
- Verificar se é bug de código do consumidor ou dependência externa
  instável.
- Se transitório: aguardar próximas tentativas (backoff exponencial).
- Se código: abrir issue e considerar `descartar` após correção.

### 2.2 Fila alta (`eventos.pendentes_altos`)

- Verificar throughput do worker (logs). Se ingestão > processamento,
  aumentar concorrência ou paralelismo do consumidor.
- Verificar se há evento problemático “segurando” o lote (mesmo agregado
  em `processando` há muito tempo).

### 2.3 SLA próximo 24h (`sla.proximas`)

- Listar em `/pendencias` filtro **Prazo ≤ 24h**.
- Atuar antes do vencimento para evitar escalonamento automático de
  prioridade.

### 2.4 Cron com falha (`cron.falhas_24h`)

- Ver `/saude` → **Jobs agendados → Falhas nas últimas 24h**.
- Ler `return_message` do job.
- Reexecutar manualmente via SQL se necessário:
  ```sql
  SELECT public.sla_pendencias_processar();
  ```

---

## 3. Como reprocessar eventos travados (passo a passo)

1. Login como MASTER.
2. Ir para **`/saude`** → rolar até **Eventos travados**.
3. Para cada linha, decidir:
   - **Reprocessar** → confirmar no diálogo. Status volta a `pendente`;
     próximo `claim_eventos_dominio` pega o evento.
   - **Descartar** → confirmar no diálogo (destrutivo). Status vira
     `descartado`, motivo `descartado_via_dashboard` gravado em
     `ultimo_erro`.
4. Ações não são reversíveis pela UI; para desfazer manualmente use SQL:
   ```sql
   UPDATE public.eventos_dominio
      SET status = 'pendente', ultimo_erro = NULL
    WHERE id = '<uuid>';
   ```
   (executar via SQL Editor com service_role; será registrado em audit
   via triggers.)

---

## 4. Restaurar acesso de admin que perdeu 2FA (fluxo 7A)

1. Usuário deve ter guardado os **códigos de recuperação** entregues na
   configuração inicial de 2FA (`/seguranca`).
2. Na tela `/auth`, após informar e-mail + senha e receber o desafio TOTP,
   clicar em **“Não tenho acesso ao autenticador”**.
3. Digitar um dos códigos de recuperação (formato `XXXX-XXXX`).
4. O código é consumido (SHA-256 comparado em
   `verify_and_consume_backup_code`) e a sessão é aberta.
5. Ao entrar, o banner em `/seguranca` avisa quantos códigos restam;
   gerar novos se ≤ 3.

**Se o usuário perdeu também os códigos:**

- Outro MASTER deve remover o fator TOTP no dashboard Supabase
  (**Authentication → Users → MFA factors**).
- Zerar os backup codes:
  ```sql
  UPDATE public.usuarios SET mfa_backup_codes = '[]'::jsonb
   WHERE id = '<uuid>';
  ```
- Ao logar, o guard em `_authenticated` obrigará o usuário a reconfigurar
  o TOTP e gerar novos códigos.

---

## 5. Rotação de segredos

### 5.1 `SUPABASE_SERVICE_ROLE_KEY`

1. Dashboard Supabase → **Settings → API → Reset service_role**.
2. Atualizar em **Settings → Edge Functions → Secrets**
   (`SUPABASE_SERVICE_ROLE_KEY`).
3. Atualizar em Lovable (secret já cadastrada) via
   **Configurações → Segredos**.
4. Redeploy das server functions / edge functions.
5. Confirmar em `/saude` que os cards MASTER carregam (usam
   `has_role`/`is_master`, não service_role).

### 5.2 `SUPABASE_PUBLISHABLE_KEY` / anon

- Raramente rotacionado. Se rotacionar, atualizar `.env`
  (`VITE_SUPABASE_PUBLISHABLE_KEY`) e rebuild do front.

### 5.3 `JWT secret` (Supabase)

- **Só rotacionar em incidente confirmado.** Invalida TODAS as sessões
  ativas.
- Após rotação, avisar todos os usuários a fazer login novamente.

### 5.4 Senhas de usuários

- Fluxo self-service em `/auth` → **Esqueci minha senha**.
- Admin não altera senha diretamente — usar “Send password reset” no
  dashboard Supabase.

---

## 6. Contatos e escalação

| Papel                       | Nome           | Contato         | Horário |
| --------------------------- | -------------- | --------------- | ------- |
| Responsável técnico primário| _preencher_    | _preencher_     | 24×7 (plantão)|
| Backup técnico              | _preencher_    | _preencher_     | Horário comercial |
| Gestor de secretaria        | _preencher_    | _preencher_     | Horário comercial |
| Supabase (suporte)          | Dashboard → Support | Ticket web  | SLA do plano |
| Lovable (suporte)           | Chat da plataforma  | Chat web    | SLA do plano |

**Regra de escalação:**

1. Alerta ÂMBAR persistente > 30 min → notificar responsável primário.
2. Alerta VERMELHO → acionar responsável primário imediatamente.
3. Alerta VERMELHO não resolvido em 1h → escalar para backup técnico.
4. Impacto a mais de 1 secretaria → notificar gestor.

---

## 7. Referências rápidas

- Painel operacional: `/saude`
- Segurança do usuário atual: `/seguranca`
- Checklist de produção: `docs/production-checklist.md`
- Manual de hardening: `docs/hardening-manual.md`
- Auditoria: `SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 100;`