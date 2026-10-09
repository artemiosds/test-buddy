import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useFolhaFinanceiraParams, useHistoricoFinanceiroProfissional } from "@/hooks/use-folha-financeira";
import { brl, calcularFolha } from "@/lib/folha-financeira";

type Props = {
  profissionalId: string | null | undefined;
  cargoId: string | null | undefined;
  salarioProprio: number | null;
  cargaCargo?: number | null;
  vinculoNome?: string | null;
};

/** Histórico financeiro calculado a partir das folhas APROVADAS (somente leitura). */
export function HistoricoFinanceiroCard({ profissionalId, cargoId, salarioProprio, cargaCargo, vinculoNome }: Props) {
  const [open, setOpen] = useState(false);
  const { data: params } = useFolhaFinanceiraParams();
  const { data: hist = [], isLoading } = useHistoricoFinanceiroProfissional(open ? profissionalId : null);
  if (!profissionalId) return null;

  const salCargo = cargoId ? params?.cargos[cargoId]?.salario_base ?? null : null;

  return (
    <div className="mt-4 rounded-md border border-border bg-background">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Evolução por competência (folhas aprovadas)
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          Salário do cargo: {salCargo ? brl(salCargo) : "não definido"}
          {salarioProprio ? ` · próprio: ${brl(salarioProprio)}` : ""}
        </span>
      </button>
      {open && (
        <div className="max-h-72 overflow-auto border-t border-border">
          {isLoading || !params ? (
            <p className="p-3 text-xs text-muted-foreground">Carregando…</p>
          ) : hist.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">Nenhuma folha aprovada encontrada para este profissional.</p>
          ) : (
            <table className="w-full whitespace-nowrap text-xs">
              <thead className="sticky top-0 bg-muted text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left">Comp.</th>
                  <th className="px-2 py-1.5 text-right">Dias/Faltas/Atest.</th>
                  <th className="px-2 py-1.5 text-right">HE 50/100</th>
                  <th className="px-2 py-1.5 text-right">ADN</th>
                  <th className="px-2 py-1.5 text-right">Plant.</th>
                  <th className="px-2 py-1.5 text-right">Bruto</th>
                  <th className="px-2 py-1.5 text-right">Descontos</th>
                  <th className="px-2 py-1.5 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, i) => {
                  const r = calcularFolha(
                    { ...h.entrada, cargo_id: cargoId ?? null, salario_proprio: salarioProprio, carga_cargo: cargaCargo ?? null, vinculo_nome: vinculoNome ?? null },
                    params,
                  );
                  const e = h.entrada;
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{h.competencia} <span className="text-muted-foreground">{e.tipo === "efetivos" ? "Ef." : "Ct."}</span></td>
                      <td className="px-2 py-1 text-right">{e.diasTrabalhados} / {e.faltasInjustificadas} / {e.atestado}</td>
                      <td className="px-2 py-1 text-right">{e.he50} / {e.he100}</td>
                      <td className="px-2 py-1 text-right">{e.adn}</td>
                      <td className="px-2 py-1 text-right">{e.plantoes}</td>
                      <td className="px-2 py-1 text-right">{brl(r.bruto)}</td>
                      <td className="px-2 py-1 text-right">{brl(r.descontos)}</td>
                      <td className="px-2 py-1 text-right font-medium">{brl(r.liquido)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="px-3 py-2 text-[11px] text-muted-foreground">Projeção pelas regras da Configuração ➔ Folha financeira. Não altera folhas nem o cadastro.</p>
        </div>
      )}
    </div>
  );
}
