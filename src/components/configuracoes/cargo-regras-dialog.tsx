import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings2 } from "lucide-react";
import type { CargoFinanceiro } from "@/lib/folha-financeira";

type Regra = Omit<CargoFinanceiro, "esf">;
type Campo = { k: keyof Regra; label: string };

const TARIFAS: Campo[] = [
  { k: "valor_he50", label: "HE 50% (R$/h)" },
  { k: "valor_he100", label: "HE 100% (R$/h)" },
  { k: "valor_adn", label: "Adic. noturno (R$/h)" },
  { k: "valor_sobreaviso", label: "Sobreaviso (R$/un.)" },
  { k: "gratificacao_pct", label: "Gratificação (%)" },
];
const ESF: Campo[] = [
  { k: "salario_base", label: "Salário base (R$)" },
  { k: "carga_semanal", label: "Carga semanal (h)" },
  { k: "insalubridade_pct", label: "Insalubridade (%)" },
  { k: "valor_plantao", label: "Plantão (R$/un.)" },
  ...TARIFAS,
];

const parse = (s: string): number | null => {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Contagem de regras próprias definidas (para o rótulo do botão). */
export function contarRegrasCargo(v: CargoFinanceiro | undefined): number {
  if (!v) return 0;
  const proprias = TARIFAS.filter((c) => v[c.k] !== null && v[c.k] !== undefined).length;
  const esf = v.esf ? ESF.filter((c) => v.esf![c.k] !== null && v.esf![c.k] !== undefined).length : 0;
  return proprias + esf;
}

export function CargoRegrasDialog({
  nome,
  value,
  onChange,
}: {
  nome: string;
  value: CargoFinanceiro;
  onChange: (patch: Partial<CargoFinanceiro>) => void;
}) {
  const [open, setOpen] = useState(false);
  const n = contarRegrasCargo(value);
  const esf = value.esf ?? {};

  const input = (c: Campo, atual: number | null | undefined, set: (v: number | null) => void, prefix: string) => (
    <div key={prefix + c.k}>
      <Label className="text-xs" htmlFor={`${prefix}-${c.k}`}>{c.label}</Label>
      <Input
        id={`${prefix}-${c.k}`}
        className="h-8"
        type="number"
        min={0}
        step="0.01"
        value={atual ?? ""}
        placeholder="herda"
        onChange={(e) => set(parse(e.target.value))}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1" aria-label={`Regras extras de ${nome}`}>
          <Settings2 className="h-3.5 w-3.5" />
          {n > 0 ? `${n} regra(s)` : "Definir"}
          {value.esf && <span className="rounded bg-primary/15 px-1 text-[10px] text-primary">ESF</span>}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Regras do cargo — {nome}</DialogTitle>
          <DialogDescription>
            Campos vazios herdam a regra por escolaridade e, depois, a regra geral. Zero significa não pagar.
            As alterações valem após salvar a configuração e não mudam folhas já aprovadas.
          </DialogDescription>
        </DialogHeader>
        <section className="space-y-2">
          <h4 className="text-sm font-medium">Valores próprios do cargo (todos os profissionais)</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TARIFAS.map((c) => input(c, value[c.k], (v) => onChange({ [c.k]: v } as Partial<CargoFinanceiro>), "cg"))}
          </div>
        </section>
        <section className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <h4 className="text-sm font-medium">Variação ESF</h4>
          <p className="text-xs text-muted-foreground">
            Usada só para profissionais marcados como “Atuação ESF” no cadastro. Vazio = usa o valor do cargo acima.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ESF.map((c) =>
              input(c, esf[c.k], (v) => {
                const next: Regra = { ...esf, [c.k]: v };
                const vazio = Object.values(next).every((x) => x === null || x === undefined);
                onChange({ esf: vazio ? null : next });
              }, "esf"),
            )}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
