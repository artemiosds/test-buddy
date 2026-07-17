# Onda 6 — Observabilidade & Operação

Objetivo: instrumentar o sistema para operar em produção com visibilidade de erros, uso, auditoria e saúde — sem introduzir funcionalidades de negócio.

Regras da onda (herdadas):
- Não altera RLS, policies ou lógica de negócio já validadas.
- Reaproveita componentes/hooks/tokens das Ondas 3 e 4.
- Cada sublote termina com typecheck limpo + testes verdes + relatório curto.
- Backend em migração usa `supabase--migration`; nada de service_role novo.

## Sublote 6A — Logger estruturado + captura global

Substitui `console.log/error` dispersos por um logger central, e captura falhas não tratadas.

- `src/lib/logger.ts`: níveis `debug|info|warn|error`, saída JSON no server (workerd) e formatada no browser, correlação por `requestId`/`userId` quando disponível, redaction de campos sensíveis (`email`, `cpf`, `token`, `authorization`).
- Handlers globais no browser: `window.onerror`, `unhandledrejection` → `logger.error` + toast discreto.
- Middleware TanStack de request (`src/start.ts`) que loga método, path, status, duração — sem PII.
- Regra de lint (script simples via `rg`) documentada no README para caçar `console.*` fora de `logger.ts`.

Entrega: logger + 2 testes de redaction, migração de ~20 `console.error` mais críticos (server functions + guards de auth).

## Sublote 6B — Auditoria de ações críticas

Aproveitar `audit_log` e `emit_evento` já existentes: garantir cobertura consistente das ações sensíveis do frontend, sem duplicar o que triggers já registram.

- Auditar no cliente: login/logout, troca de perfil, remoção de fator 2FA, regeneração de códigos de recuperação, aprovação/rejeição de frequência, exclusão de pendência.
- Página `/_authenticated/auditoria` (somente MASTER): lista `audit_log` com filtros (usuário, tabela, operação, período), paginação server-side, uso de `StatusBadge` + `FilterBar`.
- Zero mudança em triggers existentes.

Entrega: rota + hook `use-audit-log.ts` + 3 testes MSW (filtros, paginação, gate MASTER).

## Sublote 6C — Health dashboard interno

Rota `/_authenticated/saude` (MASTER) mostrando estado operacional em tempo quase real.

- KPIs: eventos_domínio pendentes/em_retry/falhou (últimas 24h), pendências SLA vencidas hoje, jobs `pg_cron` com falha recente, número de usuários ativos nas últimas 24h, warnings do linter Supabase (contagem).
- Server function `getSystemHealth()` agrega via `supabase.rpc` / views existentes. Nenhum novo secret.
- Componente `HealthCard` reutiliza `KpiCard` + `StatusBadge`.
- Refetch a cada 60s via TanStack Query.

Entrega: rota + função + 2 testes de agregação pura.

## Sublote 6D — Métricas de uso (client-side, anônimas)

Contagem local de eventos de produto para dimensionar uso — sem provedor externo, sem PII.

- Tabela `public.uso_eventos` (evento TEXT, usuario_id UUID null, contexto JSONB, created_at). GRANTs + RLS: INSERT autenticado próprio; SELECT MASTER.
- Hook `useTrackEvent()` com throttle e fila local (localStorage) que faz flush em batch a cada 30s ou no `visibilitychange`.
- Instrumentação em 6 pontos-chave: abrir Sala de Situação, exportar frequência, criar pendência, imprimir documento, buscar profissional, mudar competência ativa.
- Painel simples de contagem por evento/dia dentro de `/saude`.

Entrega: migração + hook + 3 testes (fila, flush, retry).

## Sublote 6E — Auditoria final e parecer

Fechamento formal da preparação para produção.

- Checklist de produção (segurança, performance, observabilidade, acessibilidade básica, SEO por rota).
- Rodar novamente: `bunx tsgo --noEmit`, `bun test`, `security_regression.sql`, `supabase--linter`.
- README técnico: como rodar, como monitorar, como reagir a alertas.
- Parecer técnico final: **APROVADO PARA PRODUÇÃO** ou **NECESSITA NOVA REVISÃO** com evidências.

Entrega: `README.md` atualizado + `docs/production-checklist.md` + relatório final.

## Ordem e portões

```text
6A  →  6B  →  6C  →  6D  →  6E
       (cada portão exige aprovação explícita antes de seguir)
```

## Fora de escopo (para não confundir)

- Integração com Sentry/Datadog/PostHog externos (exige decisão de vendor + secret + LGPD).
- 5D.1 (redeem de backup no login).
- Novas funcionalidades de produto.

Confirma o plano e libero o início do **Sublote 6A**?
