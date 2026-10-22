<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Municipal settings use mounted thematic tab panels and shared page-level form state so switching tabs preserves unsaved edits and independent service forms.
- Frequency rows use shallow memoization with stable callbacks and individual row state; preserve immediate Efetivos input updates, Contratados blur commits and the existing serial autosave — why: reduce unchanged-row rendering without changing persistence.
- Frequency realtime invalidations are coalesced in a bounded batch and disposed with their subscription; repeated same-user session confirmations do not trigger global refreshes — why: avoid redundant reload work while retaining status, user-update and logout refreshes.
- Unit and sector form saves must return the saved ID and hierarchy code and validate them through the shared confirmation helper before reporting success — why: RLS-filtered zero-row updates otherwise look successful.
- Financial payroll projection rules (rates, tax tables, per-cargo salary) live in municipio_config.parametros.financeiro and are computed by the pure module src/lib/folha-financeira.ts over approved frequency rows only — why: no schema change, never mutates attendance sheets.
- Hourly monetary rules are activated by modo_horas=unitario on explicit tariff edits; legacy parameters without that marker remain calculation-compatible, especially approval snapshots — why: never reinterpret old multipliers as currency or silently change approved history.
- Reporting consolidations are read-only overlays: cargo De-Para stays in the pure module src/lib/cargo-categorias.ts, while the função De-Para is user-maintained in municipio_config.parametros.funcoes_depara and resolved by the pure module src/lib/funcao-categorias.ts, applied only when the report groups by consolidated category — why: no schema change, registered cargo/função names are never rewritten.
- Financial rules and per-professional salary/cargo/carga are snapshotted per approved sheet (folha_financeira_snapshots.parametros + .salarios, written by DB triggers on status->aprovada; reapproval deactivates, never deletes) and projections prefer the snapshot over current params — why: later rule changes must not silently rewrite history. Financial config changes are audited by DB triggers into audit_log; salary sync runs via the transactional RPC ff_sincronizar_salarios.
- ESF identification is the explicit profissionais.atuacao_esf flag; per-cargo financial rules (own tariffs and an optional esf variation) live in parametros.financeiro.cargos and are resolved in src/lib/folha-financeira.ts as profissional > cargo ESF > cargo > nível > geral — why: same cargo can have different rules for ESF without schema changes to financial config or rewriting approved snapshots.
