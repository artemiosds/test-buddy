import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/seguranca")({
  head: () => ({ meta: [{ title: "Segurança (MFA) — GESTÃO SAÚDE ORIXIMINÁ - SMS" }] }),
  component: SegurancaPage,
});

type Factor = { id: string; friendly_name?: string | null; status: string; factor_type: string };

function SegurancaPage() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setError(error.message);
    else setFactors(([...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const verified = factors.filter((f) => f.status === "verified");

  async function startEnroll() {
    setError(null); setInfo(null); setBusy(true);
    try {
      // Clean up any previous unverified factors to avoid duplicates
      const unverified = factors.filter((f) => f.status !== "verified" && f.factor_type === "totp");
      for (const f of unverified) await supabase.auth.mfa.unenroll({ factorId: f.id });

      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `TOTP ${new Date().toLocaleDateString("pt-BR")}` });
      if (error) throw error;
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao iniciar cadastro do MFA");
    } finally {
      setBusy(false);
    }
  }

  async function verifyEnroll() {
    if (!enroll) return;
    setError(null); setBusy(true);
    try {
      const { data: ch, error: e1 } = await supabase.auth.mfa.challenge({ factorId: enroll.id });
      if (e1) throw e1;
      const { error: e2 } = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code });
      if (e2) throw e2;
      setEnroll(null);
      setCode("");
      setInfo("Autenticação em duas etapas ativada com sucesso.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(id: string) {
    if (!confirm("Remover este fator de autenticação?")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) setError(error.message);
    else setInfo("Fator removido.");
    setBusy(false);
    await load();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground">Ative a verificação em duas etapas (TOTP) usando um aplicativo autenticador (Google Authenticator, Authy, 1Password, Microsoft Authenticator).</p>
      </div>

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {info && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>}

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          {verified.length > 0 ? (
            <><ShieldCheck className="h-5 w-5 text-emerald-600" /><span className="font-medium">MFA ativo</span></>
          ) : (
            <><ShieldAlert className="h-5 w-5 text-amber-600" /><span className="font-medium">MFA não configurado</span></>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : verified.length === 0 ? (
          <>
            {!enroll ? (
              <button
                onClick={startEnroll}
                disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Ativar autenticação em duas etapas
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm">Escaneie o QR Code no seu aplicativo autenticador:</p>
                <div className="flex justify-center rounded-md border bg-white p-4">
                  <img src={enroll.qr} alt="QR Code MFA" className="h-48 w-48" />
                </div>
                <p className="text-xs text-muted-foreground">Ou insira manualmente esta chave: <code className="rounded bg-muted px-1.5 py-0.5">{enroll.secret}</code></p>
                <div>
                  <label className="mb-1 block text-sm font-medium">Código de 6 dígitos</label>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-40 rounded-md border bg-background px-3 py-2 text-sm tracking-widest"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={verifyEnroll}
                    disabled={busy || code.length !== 6}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Verificar e ativar
                  </button>
                  <button
                    onClick={async () => { await supabase.auth.mfa.unenroll({ factorId: enroll.id }); setEnroll(null); setCode(""); await load(); }}
                    disabled={busy}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <ul className="space-y-2">
            {verified.map((f) => (
              <li key={f.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{f.friendly_name || f.factor_type.toUpperCase()}</span>
                <button
                  onClick={() => removeFactor(f.id)}
                  disabled={busy}
                  className="flex items-center gap-1 text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p><strong>Obrigatório</strong> para perfis MASTER e ADMIN_SMS. Após ativar, a cada login será solicitado o código de 6 dígitos do aplicativo autenticador.</p>
      </div>
    </div>
  );
}
