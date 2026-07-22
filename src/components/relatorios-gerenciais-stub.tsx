import { Clock } from "lucide-react";

/**
 * Placeholder de tela para relatórios gerenciais planejados nas próximas ondas.
 * Mostra o escopo definido para o Secretário e a onda em que será entregue.
 */
export function StubGerencial({
  titulo,
  itens,
  onda,
}: {
  titulo: string;
  itens: string[];
  onda: number;
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-2 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        <h2 className="text-base font-semibold">{titulo}</h2>
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Onda {onda}
        </span>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        Escopo planejado para este relatório. A tela será entregue como parte do rollout em ondas
        dos Relatórios Gerenciais.
      </p>
      <ul className="list-disc space-y-1 pl-6 text-sm text-foreground/90">
        {itens.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
