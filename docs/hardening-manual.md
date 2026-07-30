# Hardening manual — passos operacionais pós-deploy

Sublote 7D (Onda 7). Reúne os itens de segurança que dependem de ação no
**dashboard Supabase** ou de decisão operacional, não de código. Cada
passo é idempotente — pode ser reexecutado sem efeito colateral.

## 1. Leaked Password Protection (HIBP)

Ativa o cruzamento de senhas novas contra o banco público
*HaveIBeenPwned*. Não bloqueia sessões existentes; apenas rejeita a
definição de uma senha já vazada no cadastro / troca.

**Passo a passo:**

1. Acesse o dashboard do projeto:
   `https://supabase.com/dashboard/project/aybbfciidtdbhieordqw/auth/policies`
2. Vá em **Authentication → Policies → Passwords** (ou
   `Authentication → Providers → Email → Password strength`).
3. Ative **“Prevent use of leaked passwords”** (HIBP).
4. Opcional (recomendado): definir **Minimum password length ≥ 12** e
   **Password strength = Lower, upper, digit, symbol**.
5. Salvar. A ativação é imediata; o linter da Supabase deixa de
   reportar a warning `0032_auth_leaked_password_protection`.

**Verificação:** rodar novamente `supabase--linter`. A warning
*“Leaked Password Protection Disabled”* deve desaparecer.

**Rollback:** desmarcar a mesma opção. Nenhum dado é migrado.

## 2. Extensões em schema `public`

**Status atual:** ✔ nenhuma pendência.

A extensão `pg_net` foi movida para o schema `extensions` na Onda 5
(`20260716171652_...sql`). Não há outras extensões instaladas em
`public`. O linter da Supabase não reporta o item
`0014_extension_in_public`.

**Como conferir:**

```sql
SELECT e.extname, n.nspname AS schema
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE n.nspname = 'public';
```

Esperado: **0 linhas**. Se algum dia uma nova extensão for instalada em
`public`, mover com:

```sql
CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION <nome> SET SCHEMA extensions;
```

E ajustar o `search_path` das funções que a utilizam (ver
`verify_and_consume_backup_code` como referência: usa
`SET search_path = public, extensions, pg_temp`).

## 3. Warnings esperados do linter (não são vulnerabilidades)

Contagem atual: **19 warnings** — todas classificadas e aceitas:

- **3 × `0028_anon_security_definer_function_executable`** — funções
  executáveis por `anon`. São chamadas de fluxo de auth/RLS que
  precisam rodar antes do login (ex.: leitura de perfil público, hash
  de sessão). O acesso é gated internamente por `auth.uid()` e por
  guards de escopo.
- **15 × `0029_authenticated_security_definer_function_executable`** —
  funções internas endurecidas (`is_master`, `has_permission`,
  `user_has_unit`, `user_has_secretaria`, `log_client_action`,
  `track_uso`, `verify_and_consume_backup_code`, health/uso métricas,
  fila de eventos etc.). Todas com guard `IF _caller IS NOT NULL AND
  ... RAISE EXCEPTION 42501` e/ou gate por `is_master`. Cobertas por
  `supabase/tests/security_regression.sql` (14/14).
- **1 × `0032_auth_leaked_password_protection`** — item 1 desta
  página; ativação manual no dashboard.

**Ação:** revisar esta lista após cada nova migration. Se uma nova
warning aparecer fora deste catálogo, tratar como regressão de
segurança (novo item no `security_regression.sql`).

## 4. Rotação de segredos

Segredos do runtime (`SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`,
`SUPABASE_DB_URL`) devem ser rotacionados:

- Imediatamente em caso de suspeita de vazamento.
- Preventivamente a cada 12 meses.

Nenhum segredo fica versionado — todos são injetados pelo runtime.

## 5. Checklist rápido

| Item                                   | Frequência         | Onde                      |
| -------------------------------------- | ------------------ | ------------------------- |
| Ativar HIBP                            | uma vez            | Dashboard → Auth          |
| Rodar `supabase--linter`               | a cada migration   | CLI / MCP                 |
| Rodar `security_regression.sql`        | a cada migration   | SQL Editor                |
| Auditar extensões em `public`          | trimestral         | SQL (query acima)         |
| Rotacionar service role key            | 12 meses           | Dashboard → Settings/API  |
| Revisar `audit_log` e `uso_eventos`    | mensal             | Rota `/saude` + `/auditoria` |