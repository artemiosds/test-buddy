# Guia de Implantação — Health Payroll Manager

Documento operacional para colocar o sistema em produção do zero. Complementa
`docs/runbook.md` (incidentes) e `docs/hardening-manual.md` (ações manuais no painel Supabase).

---

## 1. Pré-requisitos

| Item | Versão / Observação |
|---|---|
| Conta Supabase | Plano Pro recomendado (pg_cron, backups diários) |
| Node.js | ≥ 20.x LTS |
| Bun | ≥ 1.1.x (`curl -fsSL https://bun.sh/install \| bash`) |
| Supabase CLI | ≥ 1.180 (`npm i -g supabase`) |
| Git | ≥ 2.40 |
| Acesso ao painel Supabase | Role Owner ou Admin |

**Variáveis de ambiente obrigatórias** (ver `.env.example`):

- `VITE_SUPABASE_URL` / `SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `CRON_SECRET` (recomendado)
- `SESSION_SECRET` (obrigatório se usar `useSession`)

---

## 2. Passo a passo de deploy

### 2.1. Criar projeto Supabase

1. Acesse <https://supabase.com/dashboard> → **New project**.
2. Escolha região próxima aos usuários finais (menor latência de RLS).
3. Anote a senha do Postgres (será usada em migrações locais).
4. Aguarde o provisionamento (~2 min).

### 2.2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Preencha `.env` com os valores obtidos em **Project Settings → API**:
- `Project URL` → `VITE_SUPABASE_URL` e `SUPABASE_URL`
- `anon public` → `VITE_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_PUBLISHABLE_KEY`
- `service_role` (revelar) → `SUPABASE_SERVICE_ROLE_KEY`

Gere segredos aleatórios:

```bash
openssl rand -hex 32   # CRON_SECRET
openssl rand -hex 32   # SESSION_SECRET
```

### 2.3. Rodar migrações

```bash
bun install
supabase link --project-ref <SEU_REF>
supabase db push
```

Verifique que todas as migrações em `supabase/migrations/` foram aplicadas
(painel Supabase → **Database → Migrations**).

### 2.4. Seed mínimo

O sistema exige pelo menos:
- Perfis padrão (`master`, `gestor_rh`, `analista`, `visualizador`).
- Um usuário MASTER inicial.

```bash
# Perfis já são criados via migração seed (verificar `supabase/migrations/*_seed_*.sql`).
# Criar usuário MASTER via painel Supabase:
#   Authentication → Users → Add user → email + senha temporária
# Depois, no SQL Editor:
INSERT INTO public.usuarios (id, email, perfil_id, ativo)
SELECT u.id, u.email, (SELECT id FROM perfis WHERE nome='master'), true
FROM auth.users u WHERE u.email = 'admin@seudominio.com';
```

### 2.5. Configurar autenticação

No painel Supabase → **Authentication → Providers**:
- **Email**: habilitado. Desative signup público se não desejado.
- **URL Configuration**:
  - Site URL: `https://<seu-dominio>`
  - Redirect URLs: adicione `https://<seu-dominio>/**` e `http://localhost:8080/**` (dev).
- **Email Templates**: revisar templates de reset e confirmation.

### 2.6. Ativar HIBP (Have I Been Pwned)

**Objetivo:** bloquear senhas conhecidamente vazadas.

1. Painel Supabase → **Authentication → Policies → Password Protection**.
2. Ative **"Prevent use of leaked passwords"**.
3. Configure força mínima para **"Strong"** (12+ caracteres, mistura).
4. Salvar.

> *Tela mostra dois toggles principais e um dropdown de força; após salvar, aparece badge verde "Leaked password protection: ON".*

### 2.7. Mover extensões restantes para schema `extensions`

No **SQL Editor** rode:

```sql
SELECT extname, extnamespace::regnamespace
FROM pg_extension
WHERE extnamespace::regnamespace::text = 'public';
```

Para cada extensão listada (exceto `plpgsql`):

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION <nome> SET SCHEMA extensions;
```

Rode o linter novamente até que **0 warnings** de "Extension in Public" apareçam.

### 2.8. Rodar regressão de segurança

```bash
supabase db execute -f supabase/tests/security_regression.sql
```

Confirmar saída **14/14 OK**. Se falhar, NÃO prosseguir com o deploy.

### 2.9. Rodar testes de aplicação

```bash
bun test
```

Esperado: **50 passed, 0 failed**.

### 2.10. Build de produção

```bash
bun run build
```

Verifique:
- Nenhum erro de typecheck.
- Bundle final gerado em `.output/` (ou pasta configurada pelo TanStack Start).

### 2.11. Deploy da edge function / worker

O template roda em Cloudflare Workers via TanStack Start:

```bash
# Se usando Lovable Cloud: clicar em Publish no editor.
# Se self-hosted: seguir https://docs.lovable.dev/tips-tricks/self-hosting
```

Se houver edge functions Supabase adicionais:

```bash
supabase functions deploy <function-name>
```

### 2.12. Rotação inicial de segredos

**Obrigatório antes de abrir para usuários finais.**

1. **JWT Secret**: Painel → **Project Settings → API → JWT Settings → Generate new secret**.
   - Invalida todas as sessões ativas.
2. **Service Role Key**: gerada junto com o JWT. Atualize `SUPABASE_SERVICE_ROLE_KEY` no ambiente de produção.
3. **Senha MASTER**: force reset via **Authentication → Users → ⋯ → Send password recovery**.
4. **CRON_SECRET** e **SESSION_SECRET**: se foram compartilhados durante setup, gerar novos com `openssl rand -hex 32`.

---

## 3. Rollback

### 3.1. Reverter migrações

Migrações Supabase são forward-only por padrão. Para reverter:

```bash
# Opção A — restore de backup (recomendado para produção):
#   Painel → Database → Backups → Restore point-in-time

# Opção B — migração de reversão manual:
supabase migration new revert_<nome_da_migracao>
# Escrever SQL de reversão (DROP TABLE, ALTER TABLE ... DROP COLUMN, etc.)
supabase db push
```

### 3.2. Restaurar segredos anteriores

- JWT Secret **não pode** ser restaurado após rotação — apenas regenerado.
- Guarde os valores anteriores em cofre (1Password, Vault) por 24h após rotação, caso precise reverter.
- Service role key: idem — a chave anterior é invalidada permanentemente.

### 3.3. Rollback de deploy

- Lovable Cloud: painel de versões → **Restore previous version**.
- Self-hosted: `git revert <commit>` + rebuild + redeploy.

---

## 4. Verificação pós-deploy

Checklist obrigatório antes de anunciar disponibilidade:

- [ ] Acessar `https://<seu-dominio>/auth` — página de login carrega sem erro.
- [ ] Fazer login como MASTER — redireciona para `/`.
- [ ] MASTER é forçado a configurar 2FA (banner em `/seguranca`).
- [ ] Acessar `/saude` — todos os cards devem estar verdes:
  - Eventos: 0 falhados definitivos.
  - SLA: 0 vencidas críticas.
  - Cron: `disponivel = true`, sem falhas 24h.
  - Disjuntores: todos `closed`.
  - Alertas: banner verde "operando dentro dos parâmetros".
- [ ] Clicar **Atualizar métricas** em Performance — total_requests > 0, p95 < 1500ms.
- [ ] Logs do worker (via `stack_modern--server-function-logs` ou dashboard) sem erros nas últimas 15 min.
- [ ] `docs/hardening-manual.md` — todas as ações operacionais confirmadas.

**Se qualquer item falhar:** parar, corrigir e re-executar checklist. Não abrir acesso a usuários com checklist incompleto.

---

## 5. Documentos relacionados

- `docs/runbook.md` — resposta a incidentes em produção.
- `docs/hardening-manual.md` — hardening pós-deploy (HIBP, extensões).
- `docs/production-checklist.md` — checklist consolidado das 9 ondas.