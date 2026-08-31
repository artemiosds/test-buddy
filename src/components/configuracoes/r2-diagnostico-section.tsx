import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, HardDrive, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { diagnosticarR2 } from "@/lib/diagnostico-r2.functions";
import { toast } from "sonner";

/**
 * Painel de verificação do armazenamento de objetos (Cloudflare R2).
 * Exclusivo para Administrador Master.
 */
export function R2DiagnosticoSection() {
  const executar = useServerFn(diagnosticarR2);
  const m = useMutation({
    mutationFn: async () => await executar({}),
    onError: (e: Error) => toast.error(e.message || "Falha ao executar o diagnóstico."),
  });

  const r = m.data;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <HardDrive className="mt-0.5 h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Armazenamento de objetos (R2)</h2>
            <p className="text-sm text-muted-foreground">
              Testa gravação, leitura e exclusão no bucket e audita os anexos ativos em busca de
              arquivos ausentes.
            </p>
          </div>
        </div>
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          {m.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Executar diagnóstico
        </Button>
      </header>

      {r ? (
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-3 text-sm ${
              r.tudo_ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            }`}
          >
            {r.tudo_ok
              ? `Tudo certo: gravação e leitura no R2 funcionando e ${r.total_anexos_r2} anexo(s) ativo(s) com binário íntegro.`
              : `Atenção: verifique os itens abaixo (${r.ausentes.length} anexo(s) sem binário).`}
          </div>

          <ul className="space-y-1.5">
            {r.etapas.map((e) => (
              <li key={e.etapa} className="flex items-start gap-2 text-sm">
                {e.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="font-medium text-foreground">{e.etapa}:</span>
                <span className="text-muted-foreground">{e.detalhe}</span>
              </li>
            ))}
          </ul>

          {r.ausentes.length > 0 ? (
            <div className="rounded-lg border border-destructive/40 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" /> Anexos ativos sem binário no bucket
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {r.ausentes.map((d) => (
                  <li key={d.id}>
                    {d.nome} — {d.tipo_entidade} — {new Date(d.created_at).toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum diagnóstico executado ainda nesta sessão.
        </p>
      )}
    </section>
  );
}

export default R2DiagnosticoSection;
