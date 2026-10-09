import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Trash2, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_FINANCEIRO,
  NIVEIS_ESCOLARIDADE,
  type NivelEscolaridade,
  type NivelFinanceiro,
  type CargoFinanceiro,
  type ParametrosFinanceiros,
} from "@/lib/folha-financeira";

type Props = {
  value: ParametrosFinanceiros;
  onChange: (v: ParametrosFinanceiros) => void;
};

const toNum = (s: string) => {
  if (s.trim() === "") return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const toNumOrNull = (s: string) => (s.trim() === "" ? null : toNum(s));

function Campo({ label, value, onChange, hint, step = "0.01" }: { label: string; value: number; onChange: (n: number) => void; hint?: string; step?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} step={step} value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(toNum(e.target.value))} />
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Bloco({ titulo, children, defaultOpen = false }: { titulo: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-md border border-border">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {titulo}
      </button>
      {open && <div className="border-t border-border p-3">{children}</div>}
    </div>
  );
}

export function FolhaFinanceiraSection({ value, onChange }: Props) {
  const set = (patch: Partial<ParametrosFinanceiros>) => onChange({ ...value, ...patch });
  const [busca, setBusca] = useState("");

  const qc = useQueryClient();
  const niveis = value.niveis ?? {};
  const setNivel = (k: NivelEscolaridade, patch: Partial<NivelFinanceiro>) =>
    set({ niveis: { ...niveis, [k]: { ...(niveis[k] ?? {}), ...patch } } });
  async function mudarNivelCargo(id: string, nivel: string) {
    const { error } = await supabase.from("cargos").update({ nivel: (nivel || null) as never }).eq("id", id);
    if (error) return toast.error(`Não foi possível alterar o nível: ${error.message}`);
    toast.success("Nível do cargo atualizado.");
    qc.invalidateQueries({ queryKey: ["folha-financeira"] });
  }
  const { data: cargos = [] } = useQuery({
    queryKey: ["folha-financeira", "cargos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome, carga_horaria_semanal, nivel")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; carga_horaria_semanal: number | null; nivel: string | null }[];
    },
  });

  const filtrados = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase("pt-BR");
    return t ? cargos.filter((c) => c.nome.toLocaleLowerCase("pt-BR").includes(t)) : cargos;
  }, [cargos, busca]);

  const configurados = cargos.filter((c) => (value.cargos[c.id]?.salario_base ?? 0) > 0).length;

  const setCargo = (id: string, patch: Partial<CargoFinanceiro>) =>
    set({ cargos: { ...value.cargos, [id]: { ...(value.cargos[id] ?? {}), ...patch } } });

  return (
    <div className="space-y-4">
      <section className="space-y-3 border-b border-border pb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Regras de cálculo</h2>
        <p className="text-xs text-muted-foreground">
          A folha de frequência continua registrando só quantidades. Estes valores transformam as quantidades aprovadas em R$ nos Dados Salariais. Atestado e falta justificada não descontam; falta injustificada desconta 1/30 do salário por dia.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          <Campo label="Salário mínimo (R$)" value={value.salario_minimo} onChange={(n) => set({ salario_minimo: n })} hint="Base da insalubridade" />
          <Campo label="Fator HE 50%" value={value.he50_fator} onChange={(n) => set({ he50_fator: n })} hint="1,5 = hora + 50%" />
          <Campo label="Fator HE 100%" value={value.he100_fator} onChange={(n) => set({ he100_fator: n })} hint="2 = hora em dobro" />
          <Campo label="Adicional noturno (%)" value={value.adn_pct} onChange={(n) => set({ adn_pct: n })} hint="Sobre a hora normal" />
          <Campo label="Valor por plantão (R$)" value={value.valor_plantao} onChange={(n) => set({ valor_plantao: n })} hint="Padrão; o cargo pode ter outro" />
          <Campo label="Valor por sobreaviso (R$)" value={value.valor_sobreaviso} onChange={(n) => set({ valor_sobreaviso: n })} />
          <Campo label="Previdência Efetivos – RPPS (%)" value={value.rpps_pct} onChange={(n) => set({ rpps_pct: n })} />
          <Campo label="ISS autônomos/RPA (%)" value={value.iss_pct} onChange={(n) => set({ iss_pct: n })} hint="Só vínculos RPA/autônomo" />
          <div>
            <Label className="text-xs">Insalubridade incide sobre</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value.insalubridade_base ?? "minimo"} onChange={(e) => set({ insalubridade_base: e.target.value as "minimo" | "salario_base" })}>
              <option value="minimo">Salário mínimo (padrão)</option>
              <option value="salario_base">Salário base do servidor</option>
            </select>
          </div>
          <div>
            <Label className="text-xs">Divisor da hora normal</Label>
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={value.divisor_modo ?? "carga"} onChange={(e) => set({ divisor_modo: e.target.value as "carga" | "fixo" })}>
              <option value="carga">Carga semanal × 5 (40h = 200h)</option>
              <option value="fixo">Fixo (mensal)</option>
            </select>
          </div>
          {value.divisor_modo === "fixo" && (
            <Campo label="Divisor fixo (h/mês)" value={value.divisor_fixo ?? 220} onChange={(n) => set({ divisor_fixo: n })} hint="Ex.: 220" />
          )}
        </div>
      </section>

      <section className="space-y-2 border-b border-border pb-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tabelas de desconto</h2>
        <Bloco titulo={`INSS – Contratados (${value.inss_faixas.length} faixas)`}>
          <div className="space-y-2">
            {value.inss_faixas.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <div><Label className="text-xs">Até (R$)</Label><Input type="number" step="0.01" value={f.ate} onChange={(e) => set({ inss_faixas: value.inss_faixas.map((x, j) => (j === i ? { ...x, ate: toNum(e.target.value) } : x)) })} /></div>
                <div><Label className="text-xs">Alíquota (%)</Label><Input type="number" step="0.01" value={f.pct} onChange={(e) => set({ inss_faixas: value.inss_faixas.map((x, j) => (j === i ? { ...x, pct: toNum(e.target.value) } : x)) })} /></div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover faixa" onClick={() => set({ inss_faixas: value.inss_faixas.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => set({ inss_faixas: [...value.inss_faixas, { ate: 0, pct: 0 }] })}><Plus className="mr-1 h-3 w-3" />Faixa</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ inss_faixas: DEFAULT_FINANCEIRO.inss_faixas })}>Restaurar padrão</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Cálculo progressivo; acima da última faixa (teto) não incide.</p>
          </div>
        </Bloco>
        <Bloco titulo={`IRRF (${value.irrf_faixas.length} faixas)`}>
          <div className="space-y-2">
            {value.irrf_faixas.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                <div><Label className="text-xs">Até (R$)</Label><Input type="number" step="0.01" placeholder="acima" value={f.ate ?? ""} onChange={(e) => set({ irrf_faixas: value.irrf_faixas.map((x, j) => (j === i ? { ...x, ate: toNumOrNull(e.target.value) } : x)) })} /></div>
                <div><Label className="text-xs">Alíquota (%)</Label><Input type="number" step="0.01" value={f.pct} onChange={(e) => set({ irrf_faixas: value.irrf_faixas.map((x, j) => (j === i ? { ...x, pct: toNum(e.target.value) } : x)) })} /></div>
                <div><Label className="text-xs">Dedução (R$)</Label><Input type="number" step="0.01" value={f.deducao} onChange={(e) => set({ irrf_faixas: value.irrf_faixas.map((x, j) => (j === i ? { ...x, deducao: toNum(e.target.value) } : x)) })} /></div>
                <Button type="button" variant="ghost" size="icon" aria-label="Remover faixa" onClick={() => set({ irrf_faixas: value.irrf_faixas.filter((_, j) => j !== i) })}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => set({ irrf_faixas: [...value.irrf_faixas, { ate: null, pct: 0, deducao: 0 }] })}><Plus className="mr-1 h-3 w-3" />Faixa</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => set({ irrf_faixas: DEFAULT_FINANCEIRO.irrf_faixas })}>Restaurar padrão</Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Base = bruto − previdência. Deixe "Até" vazio na última faixa. Confira a tabela vigente da Receita Federal.</p>
          </div>
        </Bloco>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Regras por nível de escolaridade</h2>
        <p className="text-xs text-muted-foreground">
          Cada cargo pertence a um nível. Campos vazios usam a regra geral acima. Prioridade do salário: próprio do profissional › cargo › nível.
        </p>
        <div className="overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                {["Nível", "Salário base (R$)", "Grat. escolar. (%)", "Carga sem. (h)", "Fator HE 50%", "Fator HE 100%", "Adic. not. (%)", "Plantão (R$)", "Sobreaviso (R$)", "Insalub. (%)", "Cargos"].map((h) => (
                  <th key={h} className="px-2 py-2 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NIVEIS_ESCOLARIDADE.map(({ k, h }) => {
                const v = niveis[k] ?? {};
                const campo = (f: keyof NivelFinanceiro, ph: string, step = "0.01") => (
                  <td className="px-1 py-1"><Input className="h-8 min-w-20" type="number" min={0} step={step} value={v[f] ?? ""} placeholder={ph} onChange={(e) => setNivel(k, { [f]: toNumOrNull(e.target.value) })} /></td>
                );
                return (
                  <tr key={k} className="border-t border-border">
                    <td className="px-2 py-1 font-medium">{h}</td>
                    {campo("salario_base", "—")}
                    {campo("gratificacao_pct", "0")}
                    {campo("carga_semanal", "40", "1")}
                    {campo("he50_fator", String(value.he50_fator))}
                    {campo("he100_fator", String(value.he100_fator))}
                    {campo("adn_pct", String(value.adn_pct))}
                    {campo("valor_plantao", String(value.valor_plantao))}
                    {campo("valor_sobreaviso", String(value.valor_sobreaviso))}
                    {campo("insalubridade_pct", "0")}
                    <td className="px-2 py-1 text-xs text-muted-foreground">{cargos.filter((c) => c.nivel === k).length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cargos.some((c) => !c.nivel) && (
          <p className="text-xs text-muted-foreground">{cargos.filter((c) => !c.nivel).length} cargo(s) sem nível definido — escolha o nível na tabela abaixo.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Salário por cargo <span className="ml-1 normal-case text-xs font-normal">({configurados} de {cargos.length} com salário)</span>
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar cargo" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          O profissional herda o salário do cargo. Se o cadastro dele tiver "Salário Base" preenchido, esse valor próprio prevalece (exceção).
        </p>
        <SincronizarCadastro cargos={value.cargos} lista={cargos} niveis={value.niveis} />

        <div className="max-h-80 overflow-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-2 text-left">Cargo</th>
                <th className="px-2 py-2 text-left">Nível</th>
                <th className="px-2 py-2 text-left">Salário base (R$)</th>
                <th className="px-2 py-2 text-left">Carga sem. (h)</th>
                <th className="px-2 py-2 text-left">Insalub. (%)</th>
                <th className="px-2 py-2 text-left">Plantão (R$)</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const v = value.cargos[c.id] ?? {};
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-2 py-1">{c.nome}</td>
                    <td className="px-2 py-1">
                      <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={c.nivel ?? ""} onChange={(e) => void mudarNivelCargo(c.id, e.target.value)} aria-label={`Nível de ${c.nome}`}>
                        <option value="">—</option>
                        {NIVEIS_ESCOLARIDADE.map((n) => <option key={n.k} value={n.k}>{n.h}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1"><Input className="h-8" type="number" min={0} step="0.01" value={v.salario_base ?? ""} placeholder="do nível" onChange={(e) => setCargo(c.id, { salario_base: toNumOrNull(e.target.value) })} /></td>
                    <td className="px-2 py-1"><Input className="h-8 w-20" type="number" min={0} step="1" value={v.carga_semanal ?? ""} placeholder={String(c.carga_horaria_semanal ?? 40)} onChange={(e) => setCargo(c.id, { carga_semanal: toNumOrNull(e.target.value) })} /></td>
                    <td className="px-2 py-1">
                      <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={String(v.insalubridade_pct ?? "")} onChange={(e) => setCargo(c.id, { insalubridade_pct: toNumOrNull(e.target.value) })}>
                        <option value="">Isento</option>
                        <option value="10">10% mínimo</option>
                        <option value="20">20% médio</option>
                        <option value="40">40% máximo</option>
                      </select>
                    </td>
                    <td className="px-2 py-1"><Input className="h-8 w-24" type="number" min={0} step="0.01" value={v.valor_plantao ?? ""} placeholder="padrão" onChange={(e) => setCargo(c.id, { valor_plantao: toNumOrNull(e.target.value) })} /></td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr><td colSpan={6} className="px-2 py-6 text-center text-xs text-muted-foreground">Nenhum cargo encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Grava o salário do cargo no "Salário Base" do cadastro de Profissionais (ação opcional, sob confirmação). */
function SincronizarCadastro({ cargos, lista, niveis }: { cargos: Record<string, CargoFinanceiro>; lista: { id: string; nivel: string | null }[]; niveis: ParametrosFinanceiros["niveis"] }) {
  const [modo, setModo] = useState<"vazios" | "todos">("vazios");
  const [rodando, setRodando] = useState(false);
  // Salário do cargo; se vazio, piso do nível de escolaridade do cargo.
  const resolvidos = lista
    .map((c) => {
      const sc = cargos[c.id]?.salario_base ?? 0;
      if (sc > 0) return { id: c.id, valor: sc, origem: "cargo" as const };
      const sn = (c.nivel && niveis?.[c.nivel as keyof typeof niveis]?.salario_base) || 0;
      return sn > 0 ? { id: c.id, valor: sn, origem: "nivel" as const } : null;
    })
    .filter((x): x is { id: string; valor: number; origem: "cargo" | "nivel" } => !!x);
  const alvos = resolvidos.map((r) => [r.id, { salario_base: r.valor }] as const);
  const nCargo = resolvidos.filter((r) => r.origem === "cargo").length;
  const nNivel = resolvidos.length - nCargo;

  async function sincronizar() {
    if (!alvos.length) return toast.error("Nenhum cargo com salário ou nível com piso definido.");
    const msg = modo === "vazios"
      ? `Preencher o Salário Base dos profissionais SEM salário em ${alvos.length} cargo(s) (${nCargo} pelo salário do cargo, ${nNivel} pelo piso do nível)? Exceções já cadastradas não serão alteradas.`
      : `ATENÇÃO: substituir o Salário Base de TODOS os profissionais de ${alvos.length} cargo(s) (${nCargo} pelo cargo, ${nNivel} pelo nível), inclusive exceções?`;
    if (!window.confirm(msg)) return;
    setRodando(true);
    let total = 0;
    try {
      for (const [cargoId, c] of alvos) {
        let q = supabase.from("profissionais").update({ salario_base: c.salario_base! }).eq("cargo_id", cargoId);
        if (modo === "vazios") q = q.or("salario_base.is.null,salario_base.eq.0");
        const { data, error } = await q.select("id");
        if (error) throw error;
        total += data?.length ?? 0;
      }
      toast.success(`${total} profissional(is) atualizado(s) no cadastro.`);
    } catch (e) {
      toast.error(`Falha ao sincronizar: ${(e as Error).message}`);
    } finally {
      setRodando(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
      <span className="font-medium">Sincronizar com cadastro de Profissionais:</span>
      <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} aria-label="Modo de sincronização">
        <option value="vazios">Só quem está sem salário</option>
        <option value="todos">Todos (substitui exceções)</option>
      </select>
      <Button type="button" size="sm" variant="outline" disabled={rodando || !alvos.length} onClick={sincronizar}>
        <RefreshCw className={`mr-1 h-3 w-3 ${rodando ? "animate-spin" : ""}`} />{rodando ? "Sincronizando…" : "Sincronizar"}
      </Button>
      <span className="text-muted-foreground">Salve a configuração antes, para usar os valores atuais.</span>
    </div>
  );
}
