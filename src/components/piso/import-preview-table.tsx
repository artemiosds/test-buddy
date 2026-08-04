// Tabela de pré-visualização e auditoria da importação de contratados.
// Mostra o status por linha (válido / aviso / erro) e os valores calculados.

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
  const ehHmsds = templateId === "HMSDS_SAUDE";
  const ehCaps = templateId === "CAPS_SAUDE";
  const ehAdm = templateId === "PADRAO_ADM";
  const ehHmo = templateId === "HMO_SAUDE" || ehHmsds;
  const cabecalhos = ehAdm
    ? [
        "Status",
        "Nome",
        "C.P.F.",
        "Lotação",
        "Cargo",
        "Dias",
        "Base",
        "Insalub.",
        "H.E.",
        "Ad. Not.",
        "Bruto",
        "ISS",
        "Incentivo",
        "Total",
      ]
    : ehCaps
    ? [
        "Status",
        "Nome",
        "C.P.F.",
        "Lotação",
        "Cargo",
        "Dias",
        "Base",
        "Insalub.",
        "H.E.",
        "Bruto",
        "ISS",
        "Líquido",
        "Incentivo",
        "Total",
      ]
    : ehHmsds
    ? [
        "Status",
        "Nome",
        "C.P.F.",
        "Lotação",
        "Cargo",
        "Dias",
        "Base",
        "Insalub.",
        "H.E.",
        "Ad. Not.",
        "Plantão e sobreaviso",
        "Bruto",
        "ISS",
        "Total",
        "Pensão alimentícia",
        "Incentivo",
        "Total final",
      ]
    : ehHmo
    ? [
        "Status",
        "Nome",
        "C.P.F.",
        "Lotação",
        "Cargo",
        "Dias",
        "Base",
        "Insalub.",
        "H.E.",
        "Ad. Not.",
        "Plantão e sobreaviso",
        "Bruto",
        "ISS",
        "Incentivo",
        "Total",
      ]
    : [
        "Status",
        "Nome",
        "C.P.F.",
        "Lotação",
        "Cargo",
        "Dias",
        "Base",
        "Insalub.",
        "H.E.",
        "Ad. Not.",
        "Bruto",
        "ISS",
        "Total",
        "Grat.Incentivo",
        "Aux. Transp.",
        "Incentivo",
        "Total final",
      ];


  return (
    <div className="rounded-md border">
      <div className="border-b p-3 text-sm font-medium">
        Pré-visualização e auditoria ({rows.length} linha{rows.length === 1 ? "" : "s"})
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
              return (
                <tr key={`${r.cpf ?? "sem"}-${idx}`} className="border-t">
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
                  <td className="max-w-[16rem] truncate px-2 py-1.5">{r.nome ?? "—"}</td>
                  <td
                    className={cn(
                      "whitespace-nowrap px-2 py-1.5",
                      cpfInvalido && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {r.cpf ? cpfFormatado(r.cpf) : "—"}
                  </td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5">{r.unidade ?? "—"}</td>
                  <td className="max-w-[12rem] truncate px-2 py-1.5">{r.cargo ?? "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{extra(r, "dias_trabalhados") ?? r.tempo_servico ?? 0}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.salario_base)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.insalubridade)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.hora_extra_50)}</td>
                  {!ehCaps && (
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {moedaBr(r.adicional_noturno)}
                    </td>
                  )}
                  {ehHmo && (
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {moedaBr(r.plantao ?? r.sobreaviso)}
                    </td>
                  )}
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.total_proventos)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.total_descontos)}</td>
                  {((!ehHmo && !ehAdm) || ehHmsds) && (
                    <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                      {moedaBr(
                        ehHmsds || ehCaps ? extra(r, "total_liquido_base") : r.valor_liquido,
                      )}
                    </td>
                  )}
                  {ehHmsds && (
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {moedaBr(extra(r, "pensao_alimenticia"))}
                    </td>
                  )}

                  {!ehHmo && !ehCaps && !ehAdm && (
                    <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.gratificacao)}</td>
                  )}
                  {!ehHmo && !ehCaps && !ehAdm && (
                    <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.vale_transporte)}</td>
                  )}
                  <td className="whitespace-nowrap px-2 py-1.5">{moedaBr(r.auxilio_financeiro)}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-medium">
                    {moedaBr(r.valor_final)}
                  </td>
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
