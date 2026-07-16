import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    let hasUser = false;
    try {
      const { data } = await supabase.auth.getUser();
      hasUser = !!data.user;
    } catch {
      // Se a sessão ainda estiver inicializando ou indisponível, mantém a tela de login.
    }
    if (hasUser) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Entrar — GESTÃO SAÚDE ORIXIMINÁ - SMS" },
      { name: "description", content: "Acesso ao sistema municipal de frequência e folha de pagamento" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mfa, setMfa] = useState<{ factorId: string; challengeId: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    let mounted = true;

    const redirectIfAuthenticated = () => {
      void (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!mounted || !sessionData.session) return;
          const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (!mounted) return;
          if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") return;
          navigate({ to: "/" });
        } catch (err) {
          console.error(err);
        }
      })();
    };

    redirectIfAuthenticated();

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        redirectIfAuthenticated();
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function startMfaChallenge() {
    const { data: factorsData, error: fErr } = await supabase.auth.mfa.listFactors();
    if (fErr) throw fErr;
    const factor = factorsData.totp.find((f) => f.status === "verified");
    if (!factor) throw new Error("Nenhum fator MFA encontrado. Contate o administrador.");
    const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (cErr) throw cErr;
    setMfa({ factorId: factor.id, challengeId: ch.id });
  }

  async function verifyMfa() {
    if (!mfa) return;
    setLoading(true); setError(null);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId: mfa.factorId, challengeId: mfa.challengeId, code: mfaCode });
      if (error) throw error;
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { nome_completo: nome },
          },
        });
        if (error) throw error;
        setInfo("Solicitação criada. Aguarde o usuário MASTER ativar seu acesso, definir perfil e permissões.");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setInfo("Se este e-mail estiver cadastrado, enviaremos um link para redefinir a senha.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal?.nextLevel === "aal2" && aal.currentLevel === "aal1") {
          await startMfaChallenge();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-foreground">GESTÃO SAÚDE ORIXIMINÁ - SMS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Secretaria Municipal de Saúde</p>
        </div>

        {mfa ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-medium">Verificação em duas etapas</h2>
              <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
            </div>
            <input
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border bg-background px-3 py-2 text-center text-lg tracking-[0.5em]"
            />
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <button
              onClick={verifyMfa}
              disabled={loading || mfaCode.length !== 6}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
            <button
              type="button"
              onClick={async () => { await supabase.auth.signOut(); setMfa(null); setMfaCode(""); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        ) : (
        <>
        <div className="mb-6 flex rounded-md border p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`flex-1 rounded px-3 py-1.5 transition ${mode === "signin" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded px-3 py-1.5 transition ${mode === "signup" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Solicitar acesso
          </button>
        </div>


        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Nome completo</label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
          {mode !== "forgot" && (
            <div>
              <label className="mb-1 block text-sm font-medium">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setError(null); setInfo(null); }}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Esqueci minha senha
                </button>
              )}
            </div>
          )}

          {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {info && <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading
              ? "Aguarde..."
              : mode === "signin"
                ? "Entrar"
                : mode === "signup"
                  ? "Solicitar acesso"
                  : "Enviar link de recuperação"}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => { setMode("signin"); setError(null); setInfo(null); }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Voltar para o login
            </button>
          )}
        </form>

        {mode === "signup" && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Este cadastro não libera perfil, status ou permissões; somente o usuário MASTER faz essa liberação.
          </p>
        )}
        </>
        )}
      </div>
    </div>
  );
}

