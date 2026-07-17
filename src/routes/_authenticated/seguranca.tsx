import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, Trash2, KeyRound, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { auditClient, AUDIT_ACOES } from "@/lib/audit-client";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { useCurrentUser } from "@/hooks/use-permissions";
import {
  regenerateBackupCodes,
  countBackupCodes,
} from "@/lib/mfa-backup-codes.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";

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
  const askConfirm = useConfirm();
  const { data: userCtx } = useCurrentUser();
  const mfaRequired = !!userCtx?.perfil_admin_2fa_required || !!userCtx?.is_master;

  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const regenerateFn = useServerFn(regenerateBackupCodes);
  const countFn = useServerFn(countBackupCodes);

  const { data: backupCount, refetch: refetchBackupCount } = useQuery({
    queryKey: ["mfa-backup-codes-count", userCtx?.id],
    enabled: !!userCtx?.id,
    queryFn: async () => {
      const res = await countFn({});
      return res.count;
    },
  });

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) setError(error.message);
    else setFactors(([...(data?.totp ?? []), ...(data?.phone ?? [])] as Factor[]));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const verified = factors.filter((f) => f.status === "verified");
  const hasMfa = verified.length > 0;

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
      await load();
      void auditClient.action(AUDIT_ACOES.MFA_ATIVADO);
      // Gera automaticamente o primeiro lote de códigos de recuperação.
      try {
        const res = await regenerateFn({});
        setBackupCodes(res.codes);
        void auditClient.action(AUDIT_ACOES.BACKUP_CODES_GERADOS, {
          contexto: { origem: "auto_pos_enroll" },
        });
        setInfo("Autenticação em duas etapas ativada. Guarde seus códigos de recuperação agora — eles só serão exibidos uma vez.");
        await refetchBackupCount();
      } catch (err) {
        setInfo("Autenticação em duas etapas ativada com sucesso.");
        logger.error("seguranca.backup_codes_failed", { error: err });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function removeFactor(id: string) {
    const ok = await askConfirm({
      title: "Remover este fator de autenticação?",
      description: mfaRequired
        ? "Seu perfil administrativo exige 2FA. Após remover, você será obrigado a configurar novamente para acessar o sistema."
        : "Você perderá o segundo fator vinculado a esta conta.",
      tone: "destructive",
      confirmLabel: "Remover",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) {
      setError(error.message);
    } else {
      setInfo("Fator removido.");
      void auditClient.action(AUDIT_ACOES.MFA_REMOVIDO, {
        contexto: { factor_id: id },
      });
    }
    setBusy(false);
    await load();
  }

  async function handleRegenerate() {
    const ok = await askConfirm({
      title: "Gerar novos códigos de recuperação?",
      description: "Os códigos anteriores serão invalidados imediatamente.",
      tone: "destructive",
      confirmLabel: "Gerar novos",
    });
    if (!ok) return;
    setBusy(true); setError(null);
    try {
      const res = await regenerateFn({});
      setBackupCodes(res.codes);
      void auditClient.action(AUDIT_ACOES.BACKUP_CODES_GERADOS, {
        contexto: { origem: "regeneracao_manual" },
      });
      setInfo("Novos códigos gerados. Guarde-os agora — não serão exibidos novamente.");
      await refetchBackupCount();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar códigos de recuperação");
    } finally {
      setBusy(false);
    }
  }

  async function copyBackupCodes() {
    if (!backupCodes) return;
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Segurança da conta</h1>
        <p className="text-sm text-muted-foreground">Ative a verificação em duas etapas (TOTP) usando um aplicativo autenticador (Google Authenticator, Authy, 1Password, Microsoft Authenticator).</p>
      </div>

      {mfaRequired && !hasMfa && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p className="font-semibold">Configuração obrigatória</p>
          <p className="mt-1">Seu perfil administrativo exige 2FA. O acesso às demais telas do sistema permanece bloqueado até a ativação.</p>
        </div>
      )}

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {info && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>}

      <div className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          {verified.length > 0 ? (
            <><ShieldCheck className="h-5 w-5 text-success" /><span className="font-medium">MFA ativo</span></>
          ) : (
            <><ShieldAlert className="h-5 w-5 text-warning-soft-foreground" /><span className="font-medium">MFA não configurado</span></>
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
                <div className="flex justify-center rounded-md border bg-surface-elevated p-4">
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

      {hasMfa && (
        <div className="rounded-lg border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <span className="font-medium">Códigos de recuperação</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Use estes códigos para recuperar acesso caso perca seu aplicativo autenticador. Cada código pode ser usado apenas uma vez.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {typeof backupCount === "number"
              ? `${backupCount} código(s) de recuperação ativos.`
              : "Verificando códigos ativos…"}
          </p>

          {backupCodes && (
            <div className="mt-4 space-y-3">
              <div className="rounded-md border bg-surface-elevated p-4">
                <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((c) => (
                    <li key={c} className="rounded bg-muted px-2 py-1 tracking-wider">{c}</li>
                  ))}
                </ul>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyBackupCodes}
                  className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  {copied ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar todos</>}
                </button>
                <button
                  onClick={() => setBackupCodes(null)}
                  className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  Já guardei em local seguro
                </button>
              </div>
              <p className="text-xs text-destructive">
                Estes códigos não serão exibidos novamente. Salve-os em um gerenciador de senhas ou local seguro.
              </p>
            </div>
          )}

          {!backupCodes && (
            <button
              onClick={handleRegenerate}
              disabled={busy}
              className="mt-4 rounded-md border px-3 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              Gerar novos códigos de recuperação
            </button>
          )}
        </div>
      )}

      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p><strong>Obrigatório</strong> para perfis marcados como administrativos (flag <code>admin_2fa_required</code> em <em>perfis</em>). Após ativar, a cada login será solicitado o código de 6 dígitos do aplicativo autenticador.</p>
      </div>
    </div>
  );
}
