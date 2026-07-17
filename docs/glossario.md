# Glossário de Domínio

Terminologia oficial do sistema. Use estes termos em código, UI, logs e documentação.

## Entidades

- **Unidade** — Local físico/administrativo (hospital, UPA, posto). Raiz da hierarquia operacional.
- **Setor** — Subdivisão de uma Unidade (ex.: UTI, Pronto-Socorro, Enfermaria).
- **Profissional** — Pessoa física vinculada a Unidade/Setor. Pode ser **Efetivo** (vínculo estatutário) ou **Contratado** (terceirizado).
- **Competência** — Período mensal de referência para frequência e pagamento (ex.: `2026-07`).
- **Frequência** — Registro consolidado de comparecimento de um profissional em uma competência.
- **Frequência Profissional** — Linha detalhada dia-a-dia dentro de uma Frequência.
- **Pendência** — Item que requer ação humana (correção, aprovação, complementação).
- **Aprovação** — Etapa de workflow onde um perfil autorizado libera uma Frequência.
- **Evento de Domínio** — Registro assíncrono (`eventos_dominio`) disparado por triggers para efeitos colaterais (notificações, integrações). Pode ficar "travado" e exigir reprocesso via `/saude`.

## Perfis e Permissões

- **MASTER** — Superusuário. Acesso total, inclusive `/saude` e RPCs administrativas. Exige 2FA obrigatório.
- **ADMIN** — Administrador de Unidade. Gerencia usuários e configurações locais. 2FA obrigatório.
- **GESTOR** — Aprova frequências e pendências do seu setor/unidade.
- **OPERADOR** — Registra frequência e trata pendências.
- **CONSULTA** — Somente leitura.
- **has_permission(codigo)** — Função canônica de verificação. Nunca leia perfil direto no cliente para autorização.

## Segurança

- **RLS** — Row Level Security do Postgres. Toda tabela pública tem `FORCE ROW LEVEL SECURITY`.
- **SECURITY DEFINER** — Funções que executam com privilégios do dono; usadas apenas para lógica de guarda (`is_master`, `has_permission`).
- **2FA / MFA** — Autenticação de dois fatores via TOTP. Códigos de backup SHA-256 em `usuarios.mfa_backup_codes`.
- **audit_log** — Tabela imutável de auditoria. Escrita via `log_client_action` (cliente) e middlewares (servidor).

## Resiliência e Observabilidade

- **Circuit Breaker (Disjuntor)** — Estado closed/open/half_open. 5 falhas em 30s abre por 60s. Registro global em `src/lib/circuit-breaker.ts`.
- **withBreaker(nome, fn, fallback?)** — Wrapper padrão para chamadas RPC instáveis.
- **withRetry / useRetryMutation** — Backoff exponencial (1s, 2s, 4s) para mutações idempotentes.
- **Sala de Situação** — Painel operacional agregado (`/sala-situacao`).
- **/saude** — Dashboard MASTER: alertas, breakers, eventos travados, performance (p95/p99, Top 5 rotas), cache React Query.
- **Ring Buffer de Performance** — 1000 amostras em memória por isolate do Worker.
- **uso_eventos** — Métricas anônimas de uso (feature adoption).

## Convenções Técnicas

- **Server Function** — `createServerFn` em `*.functions.ts`. Consumida via `useServerFn`.
- **Server Route** — `src/routes/api/public/*` para webhooks/cron externos.
- **Lookup Hook** — `useLookups()` em `src/hooks/use-lookups.ts` para selects de formulário.
- **StatusBadge / EmptyState / FormDialog / FilterBar.Field / Pagination** — Componentes canônicos. Nunca duplicar.