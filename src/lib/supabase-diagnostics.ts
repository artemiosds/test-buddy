// TEMPORARY DIAGNOSTIC MODULE — Auditoria Supabase em runtime.
// Objetivo: identificar por que a app tenta acessar `seu_project.supabase.co`.
// Rode uma vez na inicialização (import em src/routes/__root.tsx).
// NÃO altera lógica do sistema — apenas observa e aborta em placeholders.

const PLACEHOLDER_PATTERNS = [
  "seu_project",
  "seu-projeto",
  "your_project",
  "your-project",
  "YOUR_PROJECT",
  "placeholder",
  "SEU_PROJECT",
  "<supabase",
];

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return false;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function short(v: string | undefined | null, n = 15): string {
  if (!v) return "<vazio>";
  return v.slice(0, n) + (v.length > n ? "…" : "");
}

let ran = false;

export function runSupabaseDiagnostics(): void {
  if (ran) return;
  ran = true;

  const scope = typeof window !== "undefined" ? "browser" : "server";
  const viteUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const viteKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
    | string
    | undefined;
  const procEnv = typeof process !== "undefined" ? process.env : undefined;
  const procSupaUrl = procEnv?.SUPABASE_URL;
  const procViteUrl = procEnv?.VITE_SUPABASE_URL;
  const procPubKey = procEnv?.SUPABASE_PUBLISHABLE_KEY;
  const runtime =
    typeof window !== "undefined" ? window.__SUPABASE_CONFIG__ : undefined;

  // Resolução idêntica à de src/integrations/supabase/client.ts (linha 42-43)
  const resolvedUrl = viteUrl || runtime?.url || procSupaUrl;
  const resolvedKey = viteKey || runtime?.publishableKey || procPubKey;

  const origem = viteUrl
    ? "import.meta.env.VITE_SUPABASE_URL (embutida no bundle em BUILD-TIME)"
    : runtime?.url
      ? "window.__SUPABASE_CONFIG__.url (injetado pelo SSR em RUNTIME)"
      : procSupaUrl
        ? "process.env.SUPABASE_URL (server-only)"
        : "<nenhuma>";

  /* eslint-disable no-console */
  console.group(`[SUPABASE-DIAG] (${scope})`);
  console.log("import.meta.env.VITE_SUPABASE_URL           =", viteUrl ?? "<vazio>");
  console.log("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY[0..15] =", short(viteKey));
  console.log("process.env.SUPABASE_URL                    =", procSupaUrl ?? "<vazio>");
  console.log("process.env.VITE_SUPABASE_URL               =", procViteUrl ?? "<vazio>");
  console.log("process.env.SUPABASE_PUBLISHABLE_KEY[0..15] =", short(procPubKey));
  console.log("window.__SUPABASE_CONFIG__                  =", runtime ?? "<indisponível>");
  console.log("---");
  console.log("URL efetivamente usada pelo createClient    =", resolvedUrl ?? "<vazio>");
  console.log("Origem da URL resolvida                     =", origem);
  console.log("---");
  console.log("Criadores de client detectados no repo:");
  console.log("  • src/integrations/supabase/client.ts:39      createSupabaseClient()  → browser + SSR fallback");
  console.log("  • src/integrations/supabase/client.server.ts:32 createSupabaseAdminClient() → service_role");
  console.log("  • src/integrations/supabase/auth-middleware.ts:74 createClient() (per-request) → user token");
  console.log("Fallbacks presentes no client.ts: `||` entre VITE_SUPABASE_URL, window.__SUPABASE_CONFIG__.url e process.env.SUPABASE_URL.");
  console.log("Nenhum literal `seu_project.supabase.co` foi encontrado no código-fonte.");
  console.groupEnd();

  // Relatório resumido em uma linha (fácil de achar no Vercel logs)
  const relatorio = {
    scope,
    resolved_url: resolvedUrl ?? null,
    resolved_url_origem: origem,
    vite_supabase_url_presente: Boolean(viteUrl),
    vite_pub_key_presente: Boolean(viteKey),
    process_supabase_url_presente: Boolean(procSupaUrl),
    process_pub_key_presente: Boolean(procPubKey),
    runtime_config_presente: Boolean(runtime?.url),
    placeholder_detectado: isPlaceholder(resolvedUrl),
  };
  console.log("[SUPABASE-DIAG] relatório:", JSON.stringify(relatorio));
  /* eslint-enable no-console */

  if (isPlaceholder(resolvedUrl) || isPlaceholder(resolvedKey)) {
    throw new Error(
      "ERRO DE CONFIGURAÇÃO:\n" +
        "A aplicação está utilizando um placeholder do Supabase.\n" +
        `URL resolvida: ${resolvedUrl}\n` +
        `Origem: ${origem}\n` +
        "Verifique as variáveis de ambiente carregadas durante o build (Vercel → Project → Settings → Environment Variables).",
    );
  }
}

// Executa imediatamente ao ser importado.
runSupabaseDiagnostics();