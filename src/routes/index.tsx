import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { testSmtpConnection } from "@/lib/smtp-test.functions";
import { getSmtpEnvStatus } from "@/lib/smtp-debug.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: SmtpTestPage,
});

function SmtpTestPage() {
  const [email, setEmail] = useState("artemiosouza99@gmail.com");
  const testSmtp = useServerFn(testSmtpConnection);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const { data: envStatus } = useQuery({
    queryKey: ["smtp-env-status"],
    queryFn: () => getSmtpEnvStatus(),
  });

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await testSmtp({ data: { email } });
      setResult(res);
      if (res.ok) {
        toast.success("E-mail enviado!");
      } else {
        toast.error(`Falha: ${res.message}`);
      }
    } catch (error: any) {
      setResult({ ok: false, message: error.message });
      toast.error("Erro na execução.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 space-y-6 bg-slate-950 text-slate-50">
      <div className="max-w-md w-full space-y-4 border border-slate-800 p-6 rounded-xl bg-slate-900 shadow-2xl">
        <h1 className="text-xl font-bold text-blue-400">Teste de Servidor SMTP</h1>
        
        <div className="space-y-2 text-sm">
          <p className="text-slate-400 font-medium">Status do Ambiente:</p>
          <div className="grid grid-cols-2 gap-2">
            <Badge label="HOST" active={envStatus?.host} />
            <Badge label="PORT" active={envStatus?.port} />
            <Badge label="USER" active={envStatus?.user} />
            <Badge label="PASS" active={envStatus?.pass} />
          </div>
          {envStatus && (
            <div className="mt-2 p-2 bg-black/40 rounded text-xs font-mono text-slate-300">
              <p>Host: {envStatus.values.host}</p>
              <p>User: {envStatus.values.user}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm text-slate-400">Destinatário para Teste:</label>
          <Input 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="bg-slate-800 border-slate-700 text-slate-100"
          />
        </div>

        <Button 
          onClick={handleTest} 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 rounded-lg"
        >
          {loading ? "Enviando..." : "DISPARAR E-MAIL DE TESTE"}
        </Button>

        {result && (
          <div className={`mt-4 p-4 rounded-lg border text-sm ${result.ok ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-red-900/20 border-red-800 text-red-400'}`}>
            <p className="font-bold">{result.ok ? "SUCESSO" : "ERRO"}</p>
            <p className="mt-1">{result.message}</p>
            {result.error && <p className="mt-2 text-xs opacity-80 break-words">{result.error}</p>}
          </div>
        )}

        <div className="pt-4 text-[10px] text-slate-500 text-center flex flex-col gap-1">
          <p>Esta tela é exclusiva para depuração de SMTP.</p>
          <p className="font-mono text-blue-500 opacity-50 italic">Após configurar os segredos, clique em disparar.</p>
        </div>

      </div>
    </div>
  );
}

function Badge({ label, active }: { label: string; active: boolean | undefined }) {
  return (
    <div className={`flex items-center justify-between px-2 py-1 rounded border ${active ? 'bg-emerald-900/20 border-emerald-800 text-emerald-400' : 'bg-rose-900/20 border-rose-800 text-rose-400'}`}>
      <span className="text-[10px] font-bold">{label}</span>
      <span className="text-[10px]">{active ? "OK" : "MISSING"}</span>
    </div>
  );
}


