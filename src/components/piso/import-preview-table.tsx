// Tabela de pré-visualização e auditoria da importação de contratados.
// Mostra o status por linha (válido / aviso / erro) e os valores calculados.

import { AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";
import { cpfFormatado } from "@/lib/import-templates";
import type { Issue } from "@/lib/piso-validacao";
import type { ResolvedRow } from "@/lib/piso-import";
import { cn } from "@/lib/utils";

const BLOQUEANTES = new Set<Issue["tipo"]>([
  "cpf_ausente",
  "cpf_invalido",
  "cpf_duplicado",
  "campo_obrigatorio",
  "profissional_nao_encontrado",
]);

export type StatusLinha = "valido" | "aviso" | "erro";

function moedaBr(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Lê um campo dinâmico (criado pelo mapeamento) da linha resolvida. */
function extra(row: ResolvedRow, chave: string): number | null {
  const v = (row as unknown as Record<string, unknown>)[chave];
  return typeof v === "number" ? v : null;
}


export function statusPorLinha(
  rows: ResolvedRow[],
  issues: Issue[],
): { status: StatusLinha; motivos: string[] }[] {
  return rows.map((row, idx) => {
    const doLinha = issues.filter((i) => i.linha === idx + 1);
    const erro = doLinha.some((i) => BLOQUEANTES.has(i.tipo));
    const novo = row.status_match === "nao_localizado";
    const motivos = doLinha.map((i) => i.mensagem);
    
    // Injetar status do novo motor se presente
    if (row.validation_status === "REVIEW_REQUIRED" && !erro) {
       return { status: "aviso" as const, motivos: [...motivos, "Revisão requerida: divergência semântica detectada pela IA."] };
    }

    if (erro) return { status: "erro" as const, motivos };
    if (novo || motivos.length > 0)
      return {
        status: "aviso" as const,
        motivos: motivos.length ? motivos : ["Novo cadastro (não localizado no Cadastro)"],
      };
    return { status: "valido" as const, motivos };
  });
}

export function ImportPreviewTable({
  rows,
  issues,
  templateId,
  limite = 200,
}: {
  rows: ResolvedRow[];
  issues: Issue[];
  templateId?: string;
  limite?: number;
}) {
  const status = statusPorLinha(rows, issues);
  const visiveis = rows.slice(0, limite);
  
  const cabecalhos = [
    "Status",
    "Nome",
    "C.P.F.",
    "Cargo",
    "Dias",
    "Sal. Base",
    "Tempo Serv.",
    "Insalub.",
    "Gr. Fun. VR",
    "Gr. Niv. Sup.",
    "Aux. Fin. Piso",
    "INSS",
    "IRRF",
    "Outros Desc.",
    "T. Proventos",
    "T. Descontos",
    "Líquido",
  ];

  return (
    <div className="rounded-md border">
      <div className="border-b p-3 text-sm font-medium flex justify-between items-center">
        <span>Pré-visualização e auditoria ({rows.length} linha{rows.length === 1 ? "" : "s"})</span>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground"><Info className="h-3 w-3" /> Schema Granular v2</span>
        </div>
      </div>
      <div className="max-h-[26rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/60 text-left">
            <tr>
              {cabecalhos.map((h) => (
                <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((r, idx) => {
              const st = status[idx];
              const cpfInvalido = st.status === "erro" && (r.cpf ?? "").replace(/\D/g, "").length !== 11;
              const hasValidationReview = r.validation_status === "REVIEW_REQUIRED";

              return (
                <tr key={`${r.cpf ?? "sem"}-${idx}`} className={cn("border-t", hasValidationReview && "bg-amber-50/50")}>
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5",
                        st.status === "valido" && "bg-emerald-500/10 text-emerald-600",
                        st.status === "aviso" && "bg-amber-500/10 text-amber-600",
                        st.status === "erro" && "bg-destructive/10 text-destructive",
                      )}
                      title={st.motivos.join(" • ")}
                    >
                      {st.status === "valido" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : st.status === "aviso" ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      {st.status === "valido" ? "Válido" : st.status === "aviso" ? "Aviso" : "Erro"}
                    </span>
                  </td>
                  <td className="max-w-[16rem] truncate px-2 py-1.5" title={r.nome ?? ""}>{r.nome ?? "—"}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1.5",
                      cpfInvalido && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {r.cpf ? cpfFormatado(r.cpf) : "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5" title={r.cargo ?? ""}>{r.cargo ?? "—"}</td>
                  <td className={cn("whitespace-nowrap px-2 py-1.5 font-bold", hasValidationReview && "text-amber-700")}>
                    {extra(r, "dias_trabalhados") ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.salario_base)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.tempo_servico)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.insalubridade)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.grat_funcao_vr)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.grat_nivel_superior)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium">{moedaBr(r.aux_financeiro)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.inss)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.irrf)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{moedaBr(r.outros_descontos)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium">{moedaBr(r.total_proventos_folha)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.total_descontos_folha)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-bold text-emerald-700">{moedaBr(r.valor_liquido_folha)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > visiveis.length && (
        <div className="border-t p-2 text-xs text-muted-foreground">
          Exibindo as primeiras {visiveis.length} linhas de {rows.length}.
        </div>
      )}
    </div>
  );
}
