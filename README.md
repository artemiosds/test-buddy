# Gestão Saúde — Oriximiná / SMS

Sistema municipal de gestão de folha, frequências, profissionais e assinaturas
da Secretaria Municipal de Saúde. Aplicação full-stack em TanStack Start
(SSR/edge), React 19, Supabase (Postgres + Auth + Storage + Realtime) e
shadcn/ui sobre Tailwind v4.

## Sumário

- [Requisitos](#requisitos)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Stack técnico](#stack-técnico)
- [Ondas de endurecimento (1–6)](#ondas-de-endurecimento-16)
- [Monitoramento](#monitoramento)
- [Padrões de código](#padrões-de-código)
- [Testes](#testes)

## Requisitos

- Node 20+ (o projeto é testado com Bun 1.x)
- Bun (`curl -fsSL https://bun.sh/install | bash`)
- Um projeto Supabase (URL + publishable key + service role key)

## Como rodar localmente

```bash
bun install                # instala dependências
cp .env.example .env       # preencha SUPABASE_URL / _PUBLISHABLE_KEY / _SERVICE_ROLE_KEY
bun run dev                # sobe Vite/TanStack Start em http://localhost:8080
bunx tsgo --noEmit         # typecheck estrito (obrigatório antes de commitar)
bunx vitest run            # roda a suíte de testes (35/35 verdes hoje)
bun run build              # bundle de produção (Cloudflare Worker via Nitro)
```

## Variáveis de ambiente

Todas estão em `.env.example`. Resumo:

| Variável                          | Escopo   | Uso                                              |
| --------------------------------- | -------- | ------------------------------------------------ |
| `VITE_SUPABASE_URL`               | browser  | URL pública do Supabase (bundle)                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY`   | browser  | Anon key pública (RLS aplica no PostgREST)       |
| `VITE_SUPABASE_PROJECT_ID`        | browser  | Ref do projeto Supabase (metadados)              |
| `SUPABASE_URL`                    | server   | Mesmo valor, lido em server functions            |
| `SUPABASE_PUBLISHABLE_KEY`        | server   | Anon key, lido em server functions               |
| `SUPABASE_SERVICE_ROLE_KEY`       | server   | **Secret** — só server-side, bypassa RLS         |
| `SUPABASE_DB_URL`                 | server   | Conexão direta (jobs pg_cron, migrations)        |
| `LOVABLE_API_KEY`                 | server   | Chave AI Gateway (se a IA for utilizada)         |

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY` no frontend nem faça commit de `.env`.

## Estrutura do projeto

```text
src/
├── routes/                  # rotas file-based do TanStack Router
│   ├── __root.tsx           # shell HTML, providers globais, head/meta
│   ├── _authenticated.tsx   # layout autenticado (sidebar, breadcrumbs, guard 2FA)
│   ├── _authenticated/*     # rotas do app (frequências, profissionais, /saude, ...)
│   └── api/public/*         # endpoints HTTP públicos (webhooks/cron)
├── components/              # componentes de UI reutilizáveis (shadcn + custom)
│   ├── ui/                  # primitives shadcn
│   ├── StatusBadge.tsx      # badges padronizados (Onda 3)
│   ├── EmptyState.tsx       # estados vazios
│   ├── Skeletons.tsx        # loaders (Table/KPI/Grid)
│   ├── ConfirmDialog.tsx    # confirmação declarativa/imperativa (useConfirm)
│   └── FormDialog.tsx       # diálogo de formulário padrão
├── hooks/                   # hooks React (React Query, Supabase, MFA, tema, ...)
│   ├── use-permissions.ts   # canSee/hasPermission a partir de get_my_user_context
│   ├── use-lookups.ts       # lookups consolidados (unidades, setores, cargos, ...)
│   └── use-theme.ts         # dark/light + persistência
├── lib/                     # utilitários puros e adapters
│   ├── status.ts            # enumeração central de status de domínio
│   ├── formatters.ts        # CPF, CNPJ, moeda, datas (BR)
│   ├── logger.ts            # logger estruturado + redação de PII (Onda 6A)
│   ├── audit-client.ts      # RPC log_client_action (Onda 6B)
│   ├── usage-tracker.ts     # RPC track_uso anônimo (Onda 6D)
│   └── *.functions.ts       # server functions (createServerFn)
├── integrations/supabase/   # cliente browser + tipos gerados (não editar types.ts)
├── styles.css               # tokens semânticos + tipografia (Manrope/IBM Plex)
└── start.ts                 # middleware server (auth attach, logging, erros)

supabase/
├── migrations/              # SQL versionado (gerenciado pelo tool de migração)
└── tests/security_regression.sql  # smoke de RLS/guards (rodar no SQL Editor)

docs/
└── production-checklist.md  # parecer técnico final (Onda 6E)
```

Decisões-chave:

- Rotas file-based, sem `src/pages/`. Layouts encadeados via `<Outlet />`.
- Dados: `loader` chama `ensureQueryData(queryOptions)` e o componente
  consome com `useSuspenseQuery`. `useEffect + fetch` só em raros casos.
- Server functions (`createServerFn`) para toda lógica server-side interna;
  server routes só em `api/public/*` (webhooks, cron).
- RLS habilitada em todo o schema `public`; grants explícitos para
  `authenticated` / `service_role`; nenhum grant a `anon` sem política.

## Stack técnico

| Camada           | Tecnologia                                      |
| ---------------- | ----------------------------------------------- |
| Router / SSR     | TanStack Start v1 + TanStack Router             |
| UI               | React 19 + shadcn/ui + Tailwind v4              |
| Estado remoto    | TanStack Query 5 (`staleTime` 60s, retry 1)     |
| Backend          | Supabase (Postgres + Auth + Storage + Realtime) |
| Runtime servidor | Cloudflare Workers (via Nitro)                  |
| Tipagem          | TypeScript strict + tsgo                        |
| Testes           | Vitest + @testing-library/react + MSW           |
| Tipografia       | Manrope (display) + IBM Plex Sans (body)        |

## Ondas de endurecimento (1–6)

Sequência executada durante a Sprint de produção — nenhuma nova funcionalidade
foi adicionada; cada onda entregou robustez, segurança ou observabilidade.

- **Onda 1 — Segurança do banco.** Auditoria de RLS/`SECURITY DEFINER`,
  revogação de EXECUTE público em triggers internos, `SET search_path`
  em todas as funções, redução de warnings do linter.
- **Onda 2 — Performance de React Query.** `QueryClient` global com
  `staleTime`/`retry`/`refetchOnWindowFocus` unificados; auditoria de 150+
  `useQuery` e mapeamento das top-20 queries pesadas.
- **Onda 3 — Refatoração estrutural.** `status.ts`, `formatters.ts`,
  `StatusBadge`, `EmptyState`, `Skeletons`, `ConfirmDialog`/`useConfirm`,
  `FormDialog`, hook `use-lookups` — eliminação de duplicação.
- **Onda 4 — Design system.** Tokens CSS semânticos, dark mode completo,
  tipografia Manrope + IBM Plex, sidebar refinada, `TopBar` com breadcrumbs
  e toggle de tema, animações e cards com hover.
- **Onda 5 — Segurança & qualidade.** Endurecimento de guards
  (`is_master`, `has_permission`, `user_has_*`, `proximo_numero_pendencia`
  → `42501`), `FORCE ROW LEVEL SECURITY`, extração de lógica pura testável
  (`analytics-aggregations`, `sala-situacao-alerts`), MSW + testes de hooks
  (35/35 verdes), 2FA administrativo obrigatório (`admin_2fa_required` +
  backup codes hasheados).
- **Onda 6 — Observabilidade & operação.**
  - 6A logger estruturado com redação de PII (CPF, e-mail, tokens).
  - 6B auditoria de ações críticas via RPC `log_client_action`.
  - 6C dashboard `/saude` MASTER (eventos de domínio, SLA de pendências, pg_cron).
  - 6D métricas de uso anônimas (`uso_eventos` + `track_uso` + `uso_metricas`,
    seção “Uso do sistema” no `/saude`).
  - 6E parecer de produção (este documento + `docs/production-checklist.md`).

## Monitoramento

- **`/saude`** (MASTER-only): barramento de eventos, SLA, pg_cron, uso
  anônimo de 7 dias.
- **`/auditoria`**: consultas na tabela `audit_log` filtradas por operação
  (`login`, `logout`, `custom`, `insert`, `update`, `delete`).
- **Logger (`src/lib/logger.ts`)**: emite JSON estruturado; PII é redigida
  antes do transporte. Erros globais do browser são capturados via
  `window.addEventListener`.
- **Supabase Dashboard**: acompanhar o linter e os logs de Auth / DB / cron.

## Padrões de código

- Reutilize `StatusBadge`, `EmptyState`, `Skeletons`, `ConfirmDialog`,
  `FormDialog` antes de criar variantes novas.
- Formatação de dados (CPF, CNPJ, moeda, data) via `src/lib/formatters.ts`.
- Enums de status de domínio via `src/lib/status.ts` — não repita strings.
- Novas queries: comece por `useSuspenseQuery` com `queryOptions` reusável;
  para paginação use `keepPreviousData: true`.
- Nunca `console.log` em produção; use `logger.info/warn/error`.
- Server functions vivem em `*.functions.ts`; helpers server-only em
  `*.server.ts` e nunca importados por rotas.
- Novas tabelas: `CREATE TABLE` → `GRANT` explícito → `ENABLE RLS` →
  `CREATE POLICY` (na mesma migration).

## Testes

- `bunx vitest run` — suíte JS/TS (35 testes: logger, agregações de
  analítico, alertas da Sala de Situação, `use-permissions`,
  `use-analytics`).
- `supabase/tests/security_regression.sql` — smoke de RLS e guards
  (14 asserts). Rodar no SQL Editor com dois UUIDs (master + comum);
  não commitar os UUIDs.

## Publicação

O bundle é gerado por `bun run build` e publicado como Worker Cloudflare
através da integração Lovable. Os secrets de servidor (`SUPABASE_*`,
`LOVABLE_API_KEY`) ficam no cofre do projeto — não em `.env` local.