/** Cores e rótulos padronizados para o status de cada linha da folha. */

export function statusLinhaLabel(status: string | null | undefined): string {
  switch (status ?? "pendente") {
    case "aprovada":
      return "Aprovada";
    case "rejeitada":
      return "Rejeitada";
    case "devolvida":
      return "Devolvida";
    case "em_analise":
      return "Em análise";
    default:
      return "Pendente";
  }
}

export function statusLinhaClass(status: string | null | undefined): string {
  switch (status ?? "pendente") {
    case "aprovada":
      return "border-emerald-500/60 text-emerald-600 bg-emerald-500/10";
    case "rejeitada":
      return "border-red-500/60 text-red-600 bg-red-500/10";
    case "devolvida":
      return "border-amber-500/60 text-amber-600 bg-amber-500/10";
    case "em_analise":
      return "border-sky-500/60 text-sky-600 bg-sky-500/10";
    default:
      return "border-muted-foreground/40 text-muted-foreground bg-muted/40";
  }
}
