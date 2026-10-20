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
- Unit and sector form saves must return the saved ID and hierarchy code and validate them through the shared confirmation helper before reporting success — why: RLS-filtered zero-row updates otherwise look successful.
- Financial payroll projection rules (rates, tax tables, per-cargo salary) live in municipio_config.parametros.financeiro and are computed by the pure module src/lib/folha-financeira.ts over approved frequency rows only — why: no schema change, never mutates attendance sheets.
- Reporting consolidations are read-only overlays: cargo De-Para stays in the pure module src/lib/cargo-categorias.ts, while the função De-Para is user-maintained in municipio_config.parametros.funcoes_depara and resolved by the pure module src/lib/funcao-categorias.ts, applied only when the report groups by consolidated category — why: no schema change, registered cargo/função names are never rewritten.
- Financial rules and per-professional salary/cargo/carga are snapshotted per approved sheet (folha_financeira_snapshots.parametros + .salarios, written by DB triggers on status->aprovada; reapproval deactivates, never deletes) and projections prefer the snapshot over current params — why: later rule changes must not silently rewrite history. Financial config changes are audited by DB triggers into audit_log; salary sync runs via the transactional RPC ff_sincronizar_salarios.
