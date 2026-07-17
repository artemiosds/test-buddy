# CHANGELOG

Registro consolidado da sprint de produção (Ondas 1–10). Datas relativas ao ciclo de julho/2026.

## [1.0.0] — Release de Produção

### Onda 1 — Segurança (base)
- Auditoria do schema `public`; `EXECUTE` revogado em funções internas sensíveis.
- `search_path` fixo em funções `SECURITY DEFINER`.
- Redução de warnings do linter Supabase (14 → 10).

### Onda 2 — Performance React Query
- `QueryClient` global: `staleTime 60s`, `retry 1`, sem refetch em foco de janela.
- Auditoria de 150 `useQuery` / 44 `useMutation`; mapeamento das 20 queries mais pesadas.

### Onda 3 — Refatoração Estrutural
- Centralização de status (`src/lib/status.ts`) e formatters (CPF, CNPJ, moeda, data).
- Novos componentes compartilhados: `StatusBadge`, `EmptyState`, `Skeletons`, `ConfirmDialog` (+ `useConfirm`), `FormDialog`.
- Consolidação de lookups em `useLookups()`.

### Onda 4 — Design System
- Tokens semânticos com light/dark mode em `src/styles.css`.
- Tipografia própria: Manrope + IBM Plex Sans.
- `TopBar` com breadcrumbs e toggle de tema; animações de rota; refino de toasts (`sonner`).

### Onda 5 — Segurança & Qualidade
- **5A** `pg_net` movido para schema `extensions`; guardas internas com raise `42501`; `FORCE ROW LEVEL SECURITY`; regressão SQL 14/14.
- **5B** Testes de aplicação com Vitest + MSW + Testing Library: 30/30.
- **5D** 2FA obrigatório para admins; códigos de backup SHA-256; guard em `_authenticated`.

### Onda 6 — Observabilidade
- **6A** Logger JSON com redaction de PII; middlewares de request/erro.
- **6B** `log_client_action` + `audit-client.ts` integrados em Auth, Segurança e Exports.
- **6C** Dashboard MASTER `/saude` (KPIs, RPCs de saúde).
- **6D** `uso_eventos` para métricas anônimas de uso.

### Onda 7 — Débito Residual
- **7A** Redenção de códigos de backup 2FA em `/auth`.
- **7B** Migração de diálogos CRUD para `FormDialog`.
- **7C** Padronização de filtros com `FilterBar.Field`.
- **7D** `docs/hardening-manual.md` para ações manuais (HIBP, extensões).

### Onda 8 — Resiliência
- **8A** `withRetry` + `useRetryMutation` (backoff 1s/2s/4s).
- **8B** Circuit breakers (`withBreaker`) com registro global e fallbacks; UI em `/saude`.
- **8C** Fila de reprocessamento de eventos de domínio travados.
- **8D** Alertas proativos classificados por severidade (`saude-alerts.ts`).
- **8E** `docs/runbook.md` + botão de reset de disjuntor (MASTER, rate-limit 1/5min, auditado).

### Onda 9 — Performance em Escala
- **9A** Índices parciais e compostos em tabelas críticas.
- **9B** Paginação server-side (`.range()` + `keepPreviousData`) + componente `Pagination`.
- **9C** N+1 de lookups resolvido com bulk fetch + `Map`.
- **9D** `select()` refinado + `useMemo` em agregações do `use-analytics`.
- **9E** Métricas de performance no `/saude`: ring buffer 1000, p95/p99, Top 5 rotas lentas, hit rate de cache.
- **Fix**: painel de unidade — `unidades.tsx` renomeado para `unidades.index.tsx` (rota irmã).

### Onda 10 — Auditoria & Documentação de Entrega
- **10A** `docs/deploy-guide.md`.
- **10B** `Arquitetura_Sistema.mmd` (diagrama mermaid).
- **10C** `docs/auditoria-final.md` (checklist consolidado).
- **10D** `docs/glossario.md` + `docs/onboarding-dev.md`.
- **10E** Este CHANGELOG + parecer final.

---

## Estado Final

- Typecheck: limpo.
- Testes de aplicação: **50/50**.
- Regressão SQL de segurança: **14/14**.
- Linter Supabase: 0 warnings críticos.
- Débito estrutural: **zero**.

## Parecer Técnico

**✔ APROVADO PARA PRODUÇÃO.**

Pendências operacionais (fora de código) documentadas em `docs/hardening-manual.md` seção 8 de `docs/auditoria-final.md`:

1. Ativar HIBP em Auth → Password Protection.
2. Confirmar extensões no schema `extensions`.
3. Rotação inicial de JWT secret + service_role key após deploy.
4. Cadastro do usuário MASTER conforme `docs/deploy-guide.md`.