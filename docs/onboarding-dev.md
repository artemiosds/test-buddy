# Onboarding de Desenvolvedor

Guia mínimo para um novo dev subir o projeto, entender a arquitetura e contribuir sem quebrar convenções.

## 1. Pré-requisitos

- Node 20+, Bun (recomendado), Git.
- Acesso ao projeto Supabase (URL + chave publishable + service_role para deploy).
- Editor com TypeScript e ESLint.

## 2. Setup local

```bash
bun install
cp .env.example .env   # preencher VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
bun run dev            # http://localhost:8080
```

Testes e typecheck:

```bash
bunx vitest run        # 50/50 esperados
tsgo --noEmit          # deve terminar limpo
```

## 3. Mapa do repositório

```text
src/
  routes/                    # File-based routing (TanStack Router)
    __root.tsx               # Head, providers globais
    _authenticated/          # Subárvore protegida (auth + 2FA)
    api/public/              # Webhooks / cron (sem auth)
  components/                # UI reutilizável (shadcn + shared/)
  hooks/                     # use-permissions, use-lookups, use-analytics...
  lib/
    *.functions.ts           # createServerFn (client-safe)
    *.server.ts              # Somente servidor (nunca importar no cliente)
    circuit-breaker.ts       # withBreaker + registro
    retry-mutation.ts        # withRetry + useRetryMutation
    logger.ts                # Logger estruturado
    audit-client.ts          # log_client_action
    formatters.ts            # CPF, CNPJ, moeda, data
    status.ts                # Mapeamento canônico de status
  integrations/supabase/     # Clientes (browser, auth-middleware, .server)
supabase/
  migrations/                # SQL versionado
  tests/security_regression.sql
docs/                        # deploy, runbook, hardening, glossário...
```

## 4. Regras não-negociáveis

1. **Autorização** — sempre `has_permission('codigo')` no servidor; no cliente use `usePermissions()`. Nunca leia `perfil` para autorizar.
2. **Tokens semânticos** — nada de `text-white`, `bg-black`, hex inline. Use variáveis de `src/styles.css`.
3. **Server functions protegidas** — usam `.middleware([requireSupabaseAuth])`; nunca chamar no `loader` de rota pública.
4. **RLS** — toda nova tabela em `public` exige `GRANT` + `ENABLE ROW LEVEL SECURITY` + `POLICY` na MESMA migration.
5. **Componentes canônicos** — reutilizar `StatusBadge`, `EmptyState`, `Skeletons`, `ConfirmDialog`, `FormDialog`, `FilterBar.Field`, `Pagination`.
6. **RPCs instáveis** — envolver com `withBreaker(nome, fn, fallback?)`.
7. **Mutações idempotentes** — usar `useRetryMutation`.
8. **Sem novas features sem escopo aprovado** — o projeto está em modo produção.

## 5. Fluxo de contribuição

1. Ler `docs/glossario.md` para vocabulário de domínio.
2. Implementar a mudança seguindo padrões da seção 4.
3. Rodar `bunx vitest run` e `tsgo --noEmit`.
4. Se tocou SQL: rodar `supabase/tests/security_regression.sql` (14/14).
5. Atualizar documentação relevante (`runbook`, `deploy-guide`, `glossario`) se o comportamento operacional mudar.

## 6. Onde olhar quando algo quebra

- Erro em produção → `/saude` (alertas, breakers, eventos travados, performance).
- Fluxo de incidente → `docs/runbook.md`.
- Ação manual de infra → `docs/hardening-manual.md`.
- Deploy / rotação de segredos → `docs/deploy-guide.md`.
- Arquitetura → `Arquitetura_Sistema.mmd` (mermaid).
- Estado final e critérios de aceite → `docs/auditoria-final.md`.

## 7. Leituras recomendadas (nesta ordem)

1. `docs/glossario.md`
2. `docs/auditoria-final.md`
3. `docs/runbook.md`
4. `docs/deploy-guide.md`
5. `docs/hardening-manual.md`