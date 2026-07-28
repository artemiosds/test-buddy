import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { getPisoHistoricoProfissional } from "@/lib/piso-gestao.functions";
import { calcularPiso } from "@/lib/piso-calculo";
import type { CategoriaPiso } from "@/lib/piso-categorias";

export type LinhaPiso = {
  profissional_id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  categoria: CategoriaPiso;
  unidade: string | null;
  carga_horaria: number | null;
  salario_base: number | null;
  insalubridade: number | null;
  auxilio_financeiro: number | null;
  valor_referencia: number;
  complementacao: number;
  total_remuneracao: number;
  divergencia: boolean;
  diferenca: number;
  status_importacao: "importado" | "pendente";
};

export const fmtBRL = (v: number | null | undefined) =>
  (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}

export function MemoriaCalculoCard({ linha }: { linha: LinhaPiso }) {
  const m = calcularPiso({
    categoria: linha.categoria,
    cargaHoraria: linha.carga_horaria,
    salarioBase: linha.salario_base,
    insalubridade: linha.insalubridade,
    auxilioImportado: linha.auxilio_financeiro,
  });
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-sm font-medium">Memória de cálculo</div>
      <Row label="Categoria" value={linha.categoria.replaceAll("_", " ")} />
      <Row label="Carga horária" value={linha.carga_horaria ? `${linha.carga_horaria}h` : "44h"} />
      <Row label="Salário base" value={fmtBRL(m.salarioBase)} />
      <Row label="Insalubridade" value={fmtBRL(m.insalubridade)} />
      <Row label="Base considerada" value={fmtBRL(m.baseConsiderada)} />
      
      <Row label="Complementação calculada" value={fmtBRL(m.complementacao)} strong />
      <Row
        label="Complementação importada"
        value={m.auxilioImportado == null ? "—" : fmtBRL(m.auxilioImportado)}
      />
      <Row label="Total da remuneração" value={fmtBRL(m.totalRemuneracao)} strong />
      {m.divergencia && (
        <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
          Divergência de {fmtBRL(m.diferenca)} entre o valor calculado e o importado.
        </div>
      )}
    </div>
  );
}

export function PisoDetalheSheet({
  linha,
  open,
  onOpenChange,
}: {
  linha: LinhaPiso | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const histQ = useQuery({
    queryKey: ["piso", "historico", linha?.profissional_id],
    queryFn: () =>
      getPisoHistoricoProfissional({ data: { profissional_id: linha!.profissional_id } }),
    enabled: open && !!linha,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{linha?.nome ?? "Profissional"}</SheetTitle>
        </SheetHeader>
        {linha && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{linha.cargo ?? "Sem cargo"}</Badge>
              <Badge variant="outline">{linha.unidade ?? "Sem unidade"}</Badge>
              <Badge variant={linha.status_importacao === "importado" ? "default" : "secondary"}>
                {linha.status_importacao === "importado" ? "Importado" : "Sem importação"}
              </Badge>
            </div>

            <MemoriaCalculoCard linha={linha} />

            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-medium">Histórico por competência</div>
              {histQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : (histQ.data?.rows.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Nenhuma competência importada para este profissional.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-left text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2">Competência</th>
                        <th className="py-1 pr-2">Base</th>
                        <th className="py-1 pr-2">Complementação</th>
                        <th className="py-1">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {histQ.data!.rows.map((r: Record<string, unknown>, i: number) => (
                        <tr key={i} className="border-t">
                          <td className="py-1 pr-2">{String(r.competencia ?? "—")}</td>
                          <td className="py-1 pr-2">{fmtBRL(Number(r.salario_base ?? 0))}</td>
                          <td className="py-1 pr-2">{fmtBRL(Number(r.complementacao ?? 0))}</td>
                          <td className="py-1">{fmtBRL(Number(r.total_remuneracao ?? 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default PisoDetalheSheet;
