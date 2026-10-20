import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, calcularFolha, NIVEIS_ESCOLARIDADE, type ParametrosFinanceiros } from "@/lib/folha-financeira";

type CargoLista = { id: string; nome: string; carga_horaria_semanal: number | null; nivel: string | null };

const toNum = (s: string) => {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Simulador em memória: usa a configuração da tela (inclusive não salva). Nada é gravado. */
export function SimuladorFolha({ params, cargos, niveisPendentes }: { params: ParametrosFinanceiros; cargos: CargoLista[]; niveisPendentes: Record<string, string | null> }) {
  const [cargoId, setCargoId] = useState("");
  const [tipo, setTipo] = useState<"efetivos" | "contratados">("efetivos");
  const [nivel, setNivel] = useState("");
  const [q, setQ] = useState<Record<string, string>>({});
  const v = (k: string) => toNum(q[k] ?? "");
  const cargo = cargos.find((c) => c.id === cargoId);
  const nivelEfetivo = nivel || (cargoId ? (niveisPendentes[cargoId] !== undefined ? niveisPendentes[cargoId] : cargo?.nivel) ?? "" : "");

  const r = useMemo(
    () =>
      calcularFolha(
        {
          tipo,
          cargo_id: cargoId || null,
          salario_proprio: v("salario") || null,
          carga_cargo: v("carga") || cargo?.carga_horaria_semanal || null,
          nivel_cargo: nivelEfetivo || null,
          vinculo_nome: q.vinculo ?? null,
          diasTrabalhados: 30,
          faltasInjustificadas: v("faltas"),
          faltasJustificadas: 0,
          atestado: 0,
          he50: v("he50"),
          he100: v("he100"),
          adn: v("adn"),
          plantoes: v("plantoes"),
          sobreaviso: v("sobreaviso"),
          incentivo: v("incentivo"),
        },
        params,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params, cargoId, tipo, nivelEfetivo, q, cargo],
  );

  const campo = (k: string, label: string, hint?: string) => (
    <div>
      <Label className="text-xs" htmlFor={`sim-${k}`}>{label}</Label>
      <Input id={`sim-${k}`} type="number" min={0} step="0.01" value={q[k] ?? ""} placeholder="0" onChange={(e) => setQ((s) => ({ ...s, [k]: e.target.value }))} />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
  const origem = { profissional: "informado no simulador", cargo: "salário do cargo", nivel: "piso do nível", sem_base: "sem base configurada" }[r.origemBase];
  const linhas: [string, number, string?][] = [
    ["Salário base", r.salarioBase, origem],
    ["(−) Desconto por faltas injustificadas", -r.descontoFaltas, `${brl(r.salarioBase)} ÷ 30 × ${v("faltas")}`],
    ["Gratificação de escolaridade", r.vGratificacao],
    ["Hora extra 50%", r.vHe50, `${v("he50")} h × ${brl(r.valorHora)} × fator`],
    ["Hora extra 100%", r.vHe100, `${v("he100")} h × ${brl(r.valorHora)} × fator`],
    ["Adicional noturno", r.vAdn, `${v("adn")} h × ${brl(r.valorHora)} × %`],
    ["Plantões", r.vPlantoes, `${v("plantoes")} × valor unitário`],
    ["Sobreavisos", r.vSobreaviso, `${v("sobreaviso")} × valor unitário`],
    ["Insalubridade", r.vInsalubridade],
    ["Incentivo", r.vIncentivo, "somado direto ao bruto"],
  ];

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
        Simulação em memória: usa as regras desta tela, inclusive as ainda não salvas. Não grava nada em profissionais nem em folhas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label className="text-xs" htmlFor="sim-cargo">Cargo</Label>
          <select id="sim-cargo" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={cargoId} onChange={(e) => setCargoId(e.target.value)}>
            <option value="">— Sem cargo —</option>
            {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="sim-nivel">Nível</Label>
          <select id="sim-nivel" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">{nivelEfetivo && !nivel ? `Do cargo (${NIVEIS_ESCOLARIDADE.find((n) => n.k === nivelEfetivo)?.h ?? nivelEfetivo})` : "Do cargo"}</option>
            {NIVEIS_ESCOLARIDADE.map((n) => <option key={n.k} value={n.k}>{n.h}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-xs" htmlFor="sim-tipo">Regime</Label>
          <select id="sim-tipo" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
            <option value="efetivos">Efetivo</option>
            <option value="contratados">Contratado</option>
          </select>
        </div>
        {campo("salario", "Salário base (R$)", "Vazio = herda do cargo/nível")}
        {campo("carga", "Jornada semanal (h)", "Vazio = do cargo")}
        {campo("faltas", "Faltas injustificadas")}
        {campo("he50", "Horas extras 50%")}
        {campo("he100", "Horas extras 100%")}
        {campo("adn", "Horas noturnas")}
        {campo("plantoes", "Plantões")}
        {campo("sobreaviso", "Sobreavisos")}
        {campo("incentivo", "Incentivo (R$)")}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[["Remuneração bruta", r.bruto], ["Descontos", r.descontos], ["Líquido projetado", r.liquido]].map(([t, n]) => (
          <div key={t as string} className="rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">{t}</p>
            <p className="text-lg font-semibold">{brl(n as number)}</p>
          </div>
        ))}
      </div>

      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <caption className="sr-only">Memória de cálculo</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr><th className="px-2 py-2 text-left">Memória de cálculo</th><th className="px-2 py-2 text-left">Como</th><th className="px-2 py-2 text-right">Valor</th></tr>
          </thead>
          <tbody>
            <tr className="border-t border-border text-xs text-muted-foreground"><td className="px-2 py-1">Valor da hora</td><td className="px-2 py-1">salário ÷ divisor mensal</td><td className="px-2 py-1 text-right">{brl(r.valorHora)}</td></tr>
            {linhas.map(([t, n, how]) => (
              <tr key={t} className="border-t border-border"><td className="px-2 py-1">{t}</td><td className="px-2 py-1 text-xs text-muted-foreground">{how ?? ""}</td><td className="px-2 py-1 text-right tabular-nums">{brl(n)}</td></tr>
            ))}
            <tr className="border-t border-border font-medium"><td className="px-2 py-1" colSpan={2}>Bruto</td><td className="px-2 py-1 text-right">{brl(r.bruto)}</td></tr>
            <tr className="border-t border-border"><td className="px-2 py-1">(−) Previdência {r.previdenciaTipo}</td><td /><td className="px-2 py-1 text-right">{brl(r.previdencia)}</td></tr>
            <tr className="border-t border-border"><td className="px-2 py-1">(−) IRRF</td><td className="px-2 py-1 text-xs text-muted-foreground">base = bruto − previdência</td><td className="px-2 py-1 text-right">{brl(r.irrf)}</td></tr>
            <tr className="border-t border-border"><td className="px-2 py-1">(−) ISS</td><td /><td className="px-2 py-1 text-right">{brl(r.iss)}</td></tr>
            {r.extras.map((x) => (
              <tr key={x.nome} className="border-t border-border"><td className="px-2 py-1">(−) {x.nome}</td><td /><td className="px-2 py-1 text-right">{brl(x.valor)}</td></tr>
            ))}
            <tr className="border-t border-border font-semibold"><td className="px-2 py-1" colSpan={2}>Líquido projetado</td><td className="px-2 py-1 text-right">{brl(r.liquido)}</td></tr>
          </tbody>
        </table>
      </div>
      {r.origemBase === "sem_base" && <p className="text-xs text-destructive">Sem salário base: informe um salário, configure o cargo ou o piso do nível.</p>}
    </div>
  );
}
