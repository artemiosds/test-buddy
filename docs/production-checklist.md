# Parecer técnico final — Sprint de produção (Ondas 1–6)

_Data: 17 de julho de 2026 · Sublote 6E_

Documento gerado após execução completa das seis ondas de endurecimento.
Nenhuma alteração de código, banco, RLS ou regras de negócio foi feita
nesta auditoria — apenas verificação e consolidação.

## 1. Checklist de produção

| # | Verificação                                     | Resultado | Observação |
| - | ----------------------------------------------- | --------- | ---------- |
| 1 | `bunx tsgo --noEmit`                            | ✔ Limpo   | 0 erros    |
| 2 | `bunx vitest run`                               | ✔ 35/35   | 5 arquivos, 4,4 s |
| 3 | `security_regression.sql` (Onda 5A)             | ✔ 14/14   | Última execução manual no SQL Editor após Onda 5C.2 |
| 4 | Linter Supabase                                 | ⚠ 17 warns | Todos esperados — ver §2 |
| 5 | Variáveis de ambiente documentadas              | ✔          | `.env.example` + README §Variáveis |
| 6 | `bun run build` (Cloudflare Worker)             | ✔          | 17,5 s, dist/server e dist/client gerados |
| 7 | Timeouts/retries em chamadas críticas           | ✔          | `QueryClient` global (`retry: 1`) + toasts em mutations; Supabase Auth com refresh automático |
| 8 | Dark mode íntegro nas rotas principais          | ✔          | Sidebar, TopBar, dashboards, formulários — verificados na Onda 4; tokens semânticos aplicados em todos os componentes compartilhados |
| 9 | Mobile sem overflow em `/`, `/frequencias`, `/profissionais` | ✔          | Sidebar recolhe, tabelas com scroll horizontal, cards em `grid-cols-1` no breakpoint `sm` |

## 2. Warnings do Supabase Linter (esperados)

Total: **17** — todos aceitos e documentados como parte do modelo de
segurança da aplicação.

| Categoria                                                | Qtd | Justificativa |
| -------------------------------------------------------- | --- | ------------- |
| `0028_anon_security_definer_function_executable`         | 2   | `has_role`/`is_master` são chamadas por RLS de tabelas com política pública mínima — obrigatoriamente executáveis por `anon` para permitir avaliação de policies antes do login em rotas de auth. |
| `0029_authenticated_security_definer_function_executable`| 14  | Funções auditadas na Onda 1/5A: `get_my_user_context`, `get_my_permissions`, `has_permission`, `is_master`, `user_has_unit`, `user_has_secretaria`, `log_client_action`, `emit_evento`, `proximo_numero_pendencia`, `health_*` (3), `track_uso`, `uso_metricas`. Todas com `SECURITY DEFINER + search_path` fixo, guards internos (`auth.uid()` e `is_master`) e escopo estreito. |
| `Leaked Password Protection Disabled`                    | 1   | Config Supabase (não SQL). Requer ação manual do responsável do projeto no dashboard (Auth → Passwords). Documentado como ressalva. |

**Nenhum warning novo em relação à baseline aprovada em 5A.1**, exceto os
três somados intencionalmente pelas Ondas 6B/6C/6D
(`log_client_action`, `health_*` e `track_uso`/`uso_metricas`).

## 3. Status por subsistema

| Subsistema           | Status                    | Notas                                                                                     |
| -------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Autenticação         | ✔ APROVADO                | Supabase Auth + refresh; guard em `_authenticated` (SSR-safe, `ssr:false`, redirect `/auth`). |
| MFA (2FA admin)      | ✔ APROVADO                | `perfis.admin_2fa_required` + guard redirecionando para `/seguranca`; backup codes SHA-256. |
| Banco / RLS          | ✔ APROVADO                | RLS habilitada; `FORCE RLS` nas tabelas críticas; grants explícitos; guards com `42501`.  |
| Filas / eventos      | ✔ APROVADO                | `eventos_dominio` imutável, retry exponencial (`nack_evento_dominio`), monitorado em `/saude`. |
| SLA de pendências    | ✔ APROVADO                | Job `sla_pendencias_processar` emite `pendencia.prazo_vencido/_proximo`, escala prioridade, idempotência diária. |
| Testes automatizados | ✔ APROVADO                | 35/35 verdes. Cobertura: agregações analíticas, alertas Sala de Situação, logger, hooks (`use-permissions`, `use-analytics`). |
| Observabilidade      | ✔ APROVADO                | Logger com PII redaction, `audit_log` de ações críticas, dashboard `/saude` (eventos, SLA, cron, uso anônimo). |
| Tipografia           | ✔ APROVADO                | Manrope + IBM Plex Sans, escala unificada em `styles.css`.                                |
| Dark mode            | ✔ APROVADO                | Tokens semânticos aplicados em todos os componentes compartilhados; toggle na TopBar.     |
| Mobile / responsivo  | ✔ APROVADO COM RESSALVA   | Rotas principais OK; algumas tabelas densas (`/aprovacoes`, `/gestao-profissionais`) exigem scroll horizontal — aceitável para volume de colunas. |
| Build de produção    | ✔ APROVADO                | Compila em 17,5 s; bundles server/client separados; sem imports Node-only. |
| Segurança do linter  | ⚠ APROVADO COM RESSALVA   | 17 warnings esperados; “Leaked Password Protection” depende de config manual no dashboard. |

## 4. Débito residual consolidado

Itens conhecidos e conscientemente adiados. **Nenhum bloqueia produção.**

- **Diálogos complexos remanescentes** — os diálogos simples de CRUD
  (`feriados`, `setores`, `competencias` reabertura) foram migrados para
  `FormDialog` na Onda 7B. Permanecem em `Dialog` inline os fluxos que não
  se encaixam no formato uniforme do wrapper: `aprovacoes` (3 modais com
  ações condicionais), `assinaturas` (preview + upload), `auditoria`
  (viewer de detalhes, não é formulário), `frequencias_.$id` (copiar
  competência, pendência, anexos), `import-dialog` (multi-step com
  upload/parse/preview), `usuarios`/`profissionais` (formulários longos
  com tabs, cargos-funcoes (tabs internos). Documentados como débito
  aceito — nenhum bloqueia produção.
- **Lookups N+1** em telas de listagem de profissionais/setores — mitigados
  pelo `staleTime: 60s` global; refatorar para `select()` com join no
  Supabase quando o volume superar ~5k linhas.
- **`FilterBar.Field`** — ✔ aplicado na Onda 7C nas telas com filtros
  padronizados (`profissionais`, `gestao-rh`, `ProfessionalsPage`).
  Demais telas usam filtros específicos (data-range, tabs) que não se
  encaixam no formato label+controle e permanecem inline por desenho.
- **Sublote 5D.1** — ✔ concluído na Onda 7A: fluxo self-service de
  recuperação 2FA via código de backup implementado na tela de login
  (`verify_and_consume_backup_code` + `consumeBackupCodeAndUnenroll`).
- **Leaked Password Protection** (Supabase Auth): habilitar no dashboard.
- **`pg_net`** já movido para schema `extensions` (Onda 5). Nenhum outro
  débito de schema.

## 5. Ação manual pós-deploy

1. Dashboard Supabase → Auth → Passwords → habilitar *Leaked Password
   Protection* (HIBP).
2. Rodar `security_regression.sql` no SQL Editor com dois UUIDs
   (`app.test_master_id`, `app.test_common_id`) após cada nova migration
   que toque RLS ou `SECURITY DEFINER`.
3. Configurar retenção do `audit_log` e `uso_eventos` (recomendado:
   `audit_log` 24 meses, `uso_eventos` 6 meses) via job pg_cron quando o
   volume crescer.

## 6. Veredito final

> **✔ APROVADO PARA PRODUÇÃO.**
>
> Typecheck limpo, 35/35 testes verdes, build de produção compilando,
> RLS/2FA/auditoria/observabilidade operacionais, warnings do linter
> justificados e documentados, débito residual identificado e sem
> bloqueadores. A única ação obrigatória fora do código é habilitar o
> *Leaked Password Protection* no dashboard Supabase.