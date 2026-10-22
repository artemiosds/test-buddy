import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { salarioDoSnapshot, useFolhaFinanceiraParams, useHistoricoFinanceiroProfissional } from "@/hooks/use-folha-financeira";
import { brl, calcularFolha } from "@/lib/folha-financeira";

type Props = {
  profissionalId: string | null | undefined;
  cargoId: string | null | undefined;
  salarioProprio: number | null;
  cargaCargo?: number | null;
  vinculoNome?: string | null;
  esf?: boolean;
};

/** Histórico financeiro calculado a partir das folhas APROVADAS (somente leitura). */
export function HistoricoFinanceiroCard({ profissionalId, cargoId, salarioProprio, cargaCargo, vinculoNome, esf }: Props) {
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
                  <th className="px-2 py-1.5 text-right">HE 50%</th>
                  <th className="px-2 py-1.5 text-right">HE 100%</th>
                  <th className="px-2 py-1.5 text-right">Adic. Noturno</th>
                  <th className="px-2 py-1.5 text-right">Plantões</th>
                  <th className="px-2 py-1.5 text-right">Sobreaviso</th>
                  <th className="px-2 py-1.5 text-right">Bruto</th>
                  <th className="px-2 py-1.5 text-right">Descontos</th>
                  <th className="px-2 py-1.5 text-right">Líquido</th>
                </tr>
              </thead>
              <tbody>
                {hist.map((h, i) => {
                  const sal = profissionalId ? salarioDoSnapshot(h.snap, profissionalId) : null;
                  const r = calcularFolha(
                    {
                      ...h.entrada,
                      cargo_id: sal ? sal.cargo_id : cargoId ?? null,
                      salario_proprio: sal ? sal.salario_base : salarioProprio,
                      carga_cargo: sal ? sal.carga : cargaCargo ?? null,
                      vinculo_nome: vinculoNome ?? null,
                      esf: !!esf,
                    },
                    h.snap?.params ?? params,
                  );
                  const e = h.entrada;
                  const cel = (valor: number, qtd: number, un: string) => (
                    <td className="px-2 py-1 text-right">
                      <div>{brl(valor)}</div>
                      <div className="text-[10px] text-muted-foreground">{qtd} {un}</div>
                    </td>
                  );
                  return (
                    <tr key={i} className="border-t border-border">
                      <td className="px-2 py-1">{h.competencia} <span className="text-muted-foreground">{e.tipo === "efetivos" ? "Ef." : "Ct."}</span>{!h.snap && <span className="ml-1 text-muted-foreground" title="Sem histórico da aprovação: calculado com as regras e salários atuais">*</span>}</td>
                      <td className="px-2 py-1 text-right">{e.diasTrabalhados} / {e.faltasInjustificadas} / {e.atestado}</td>
                      {cel(r.vHe50, e.he50, "h")}
                      {cel(r.vHe100, e.he100, "h")}
                      {cel(r.vAdn, e.adn, "h")}
                      {cel(r.vPlantoes, e.plantoes, "plant.")}
                      {cel(r.vSobreaviso, e.sobreaviso, "sob.")}
                      <td className="px-2 py-1 text-right">{brl(r.bruto)}</td>
                      <td className="px-2 py-1 text-right">{brl(r.descontos)}</td>
                      <td className="px-2 py-1 text-right font-medium">{brl(r.liquido)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {hist.some((h) => !h.snap) && (
            <p className="border-t border-border p-2 text-[11px] text-muted-foreground">* Estimativa com regras e salários atuais: esta competência foi aprovada antes do registro histórico.</p>
          )}
          <p className="px-3 py-2 text-[11px] text-muted-foreground">Projeção pelas regras da Configuração ➔ Folha financeira. Não altera folhas nem o cadastro.</p>
        </div>
      )}
    </div>
  );
}
