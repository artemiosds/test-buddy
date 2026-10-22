import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Plus, Trash2, Search, RefreshCw, AlertTriangle, CheckCircle2, Undo2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SimuladorFolha } from "./simulador-folha";
import { CargoRegrasDialog } from "./cargo-regras-dialog";
import { toast } from "sonner";
import {
  DEFAULT_FINANCEIRO,
  DEFAULT_TRIBUTOS,
  type RegimeAlvo,
  type DescontoExtra,
  NIVEIS_ESCOLARIDADE,
  type NivelEscolaridade,
  type NivelFinanceiro,
  type CargoFinanceiro,
  type ParametrosFinanceiros,
  brl,
  validarFinanceiro,
} from "@/lib/folha-financeira";

type Props = {
  value: ParametrosFinanceiros;
  onChange: (v: ParametrosFinanceiros) => void;
  niveisPendentes?: Record<string, string | null>;
  onNiveisPendentes?: (v: Record<string, string | null>) => void;
  alterado?: boolean;
  onDescartar?: () => void;
  onSalvar?: () => void;
  salvando?: boolean;
  podeEditar?: boolean;
};

const toNum = (s: string) => {
  if (s.trim() === "") return 0;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const toNumOrNull = (s: string) => (s.trim() === "" ? null : toNum(s));

function Campo({ label, value, onChange, hint, step = "0.01" }: { label: string; value: number | null | undefined; onChange: (n: number) => void; hint?: string; step?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input aria-label={label} type="number" min={0} step={step} value={typeof value === "number" && Number.isFinite(value) ? value : ""} onChange={(e) => onChange(toNum(e.target.value))} />
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

type CargoLista = { id: string; nome: string; carga_horaria_semanal: number | null; nivel: string | null };

export function FolhaFinanceiraSection({ value, onChange, niveisPendentes = {}, onNiveisPendentes, alterado = false, onDescartar, onSalvar, salvando = false, podeEditar = true }: Props) {
  const set = (patch: Partial<ParametrosFinanceiros>) => onChange({ ...value, ...patch });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendentes" | "configurados">("todos");
  const [aba, setAba] = useState("visao");
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  const niveis = value.niveis ?? {};
  const setNivel = (k: NivelEscolaridade, patch: Partial<NivelFinanceiro>) =>
    set({ ...("valor_he50" in patch || "valor_he100" in patch || "valor_adn" in patch ? { modo_horas: "unitario" as const } : {}), niveis: { ...niveis, [k]: { ...(niveis[k] ?? {}), ...patch } } });

  const { data: cargosDb = [], isLoading: carregandoCargos } = useQuery({
    queryKey: ["folha-financeira", "cargos"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome, carga_horaria_semanal, nivel")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as CargoLista[];
    },
  });
  // Nível pendente (ainda não salvo) sobrepõe o do banco; grava só no "Salvar".
  const cargos = useMemo(
    () => cargosDb.map((c) => (c.id in niveisPendentes ? { ...c, nivel: niveisPendentes[c.id] } : c)),
    [cargosDb, niveisPendentes],
  );
  function mudarNivelCargo(id: string, nivel: string) {
    const original = cargosDb.find((c) => c.id === id)?.nivel ?? null;
    const novo = nivel || null;
    const prox = { ...niveisPendentes };
    if (novo === original) delete prox[id];
    else prox[id] = novo;
    onNiveisPendentes?.(prox);
  }

  const salarioDe = (c: CargoLista) => {
    const sc = value.cargos[c.id]?.salario_base ?? 0;
    if (sc > 0) return { v: sc, origem: "cargo" as const };
    const sn = (c.nivel && niveis[c.nivel as NivelEscolaridade]?.salario_base) || 0;
    return sn > 0 ? { v: sn, origem: "nivel" as const } : { v: 0, origem: "nenhum" as const };
  };

  const configurados = cargos.filter((c) => (value.cargos[c.id]?.salario_base ?? 0) > 0).length;
  const herdandoNivel = cargos.filter((c) => salarioDe(c).origem === "nivel").length;
  const semBase = cargos.filter((c) => salarioDe(c).origem === "nenhum").length;
  const semNivel = cargos.filter((c) => !c.nivel).length;

  const filtrados = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase("pt-BR");
    return cargos.filter((c) => {
      if (t && !c.nome.toLocaleLowerCase("pt-BR").includes(t)) return false;
      const tem = (value.cargos[c.id]?.salario_base ?? 0) > 0;
      if (filtro === "pendentes") return !tem;
      if (filtro === "configurados") return tem;
      return true;
    });
  }, [cargos, busca, filtro, value.cargos]);

  const setCargo = (id: string, patch: Partial<CargoFinanceiro>) =>
    set({ cargos: { ...value.cargos, [id]: { ...(value.cargos[id] ?? {}), ...patch } } });

  const avisos: { t: string; aba: string }[] = [];
  if (value.modo_horas !== "unitario") avisos.push({ t: "Valores em R$/hora ainda não configurados. Informe as três tarifas gerais e as exceções por nível antes de salvar; até lá, a configuração anterior permanece vigente.", aba: "regras" });
  if (semBase > 0) avisos.push({ t: `${semBase} cargo(s) sem salário base (nem no cargo nem no piso do nível) — a projeção sai zerada para eles.`, aba: "cargos" });
  if (semNivel > 0) avisos.push({ t: `${semNivel} cargo(s) sem nível de escolaridade definido.`, aba: "cargos" });
  if (!(value.salario_minimo > 0)) avisos.push({ t: "Salário mínimo não informado.", aba: "regras" });
  if (!(value.valor_plantao > 0)) avisos.push({ t: "Valor padrão de plantão está zerado (plantões só serão valorados onde o cargo/nível tiver valor).", aba: "regras" });
  if (!(value.valor_sobreaviso > 0)) avisos.push({ t: "Valor de sobreaviso está zerado.", aba: "regras" });
  const erroValidacao = validarFinanceiro(value);
  const nPendNivel = Object.keys(niveisPendentes).length;

  const divisorTxt = value.divisor_modo === "fixo" ? `${value.divisor_fixo ?? 220}h fixo` : "carga × 5";

  return (
    <div className="space-y-4">
      {alterado && (
        <div role="status" className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-primary/40 bg-card p-2 text-xs shadow-sm">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <span className="font-medium">Alterações não salvas na Folha financeira{nPendNivel ? ` (incluindo nível de ${nPendNivel} cargo(s))` : ""}.</span>
          <span className="text-muted-foreground">O simulador já usa esses valores.</span>
          <div className="ml-auto flex gap-2">
            <Button type="button" size="sm" variant="ghost" disabled={salvando} onClick={() => setConfirmarDescarte(true)}><Undo2 className="mr-1 h-3 w-3" />Descartar</Button>
            {onSalvar && <Button type="button" size="sm" disabled={salvando || !podeEditar || !!erroValidacao} onClick={onSalvar}>{salvando ? "Salvando…" : "Salvar"}</Button>}
          </div>
          {erroValidacao && <p className="w-full text-destructive">Corrija antes de salvar: {erroValidacao}</p>}
        </div>
      )}
      <AlertDialog open={confirmarDescarte} onOpenChange={setConfirmarDescarte}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>Os valores voltam para a última configuração salva. Nada no banco é alterado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDescartar?.()}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={aba} onValueChange={setAba}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="cargos">Salários e cargos</TabsTrigger>
          <TabsTrigger value="regras">Regras de cálculo</TabsTrigger>
          <TabsTrigger value="tributos">Tributos e descontos</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Cargos ativos", carregandoCargos ? "…" : String(cargos.length), "cargos"],
              ["Com salário no cargo", carregandoCargos ? "…" : String(configurados), "cargos"],
              ["Herdando piso do nível", carregandoCargos ? "…" : String(herdandoNivel), "cargos"],
              ["Sem salário base", carregandoCargos ? "…" : String(semBase), "cargos"],
              ["Salário mínimo", brl(value.salario_minimo), "regras"],
              ["Divisor da hora", divisorTxt, "regras"],
              ["HE 50% / 100% (R$/h)", value.modo_horas === "unitario" ? `${brl(value.valor_he50 ?? 0)} / ${brl(value.valor_he100 ?? 0)}` : "Não configurado", "regras"],
              ["Adicional noturno (R$/h)", value.modo_horas === "unitario" ? brl(value.valor_adn ?? 0) : "Não configurado", "regras"],
            ].map(([t, n, a]) => (
              <button key={t} type="button" onClick={() => setAba(a)} className="rounded-md border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <p className="text-xs text-muted-foreground">{t}</p>
                <p className="text-lg font-semibold">{n}</p>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Situação dos parâmetros</h3>
            {avisos.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" />Nenhuma configuração incompleta encontrada.</p>
            ) : (
              <ul className="space-y-1">
                {avisos.map((a) => (
                  <li key={a.t} className="flex items-start gap-2 text-xs">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span>{a.t}</span>
                    <button type="button" className="ml-auto shrink-0 text-primary underline-offset-2 hover:underline" onClick={() => setAba(a.aba)}>Abrir</button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">Tabelas de INSS/IRRF não são atualizadas automaticamente — confira as vigentes antes de usar a projeção.</p>
          </div>
        </TabsContent>

        <TabsContent value="regras" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            {[
              ["1. Só folhas aprovadas", "Rascunho, enviada, em análise, devolvida e rejeitada não entram na projeção."],
              ["2. Falta injustificada", "Desconto = salário base ÷ 30 × quantidade."],
              ["3. Falta justificada e atestado", "Não descontam do salário base."],
              ["4. Horas extras", "Horas aprovadas × tarifa em R$/hora do nível ou regra geral."],
              ["5. Adicional noturno", "Horas noturnas aprovadas × tarifa em R$/hora do nível ou regra geral."],
              ["6. Plantões e sobreavisos", "Quantidade × valor unitário (cargo › nível › geral)."],
              ["7. Incentivo", "Valor lançado na folha somado direto ao bruto."],
            ].map(([t, d]) => (
              <div key={t} className="rounded-md border border-border p-2"><p className="font-medium">{t}</p><p className="text-muted-foreground">{d}</p></div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Campo label="Salário mínimo (R$)" value={value.salario_minimo} onChange={(n) => set({ salario_minimo: n })} hint="Base da insalubridade" />
            <Campo label="Hora extra 50% (R$/h)" value={value.valor_he50} onChange={(n) => set({ modo_horas: "unitario", valor_he50: n })} />
            <Campo label="Hora extra 100% (R$/h)" value={value.valor_he100} onChange={(n) => set({ modo_horas: "unitario", valor_he100: n })} />
            <Campo label="Adicional noturno (R$/h)" value={value.valor_adn} onChange={(n) => set({ modo_horas: "unitario", valor_adn: n })} />
            <Campo label="Valor por plantão (R$)" value={value.valor_plantao} onChange={(n) => set({ valor_plantao: n })} hint="Padrão; o cargo pode ter outro" />
            <Campo label="Valor por sobreaviso (R$)" value={value.valor_sobreaviso} onChange={(n) => set({ valor_sobreaviso: n })} />
            <div>
              <Label className="text-xs">Insalubridade incide sobre</Label>
              <select className={selCls} value={value.insalubridade_base ?? "minimo"} onChange={(e) => set({ insalubridade_base: e.target.value as "minimo" | "salario_base" })}>
                <option value="minimo">Salário mínimo (padrão)</option>
                <option value="salario_base">Salário base do servidor</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Divisor da hora normal</Label>
              <select className={selCls} value={value.divisor_modo ?? "carga"} onChange={(e) => set({ divisor_modo: e.target.value as "carga" | "fixo" })}>
                <option value="carga">Carga semanal × 5 (40h = 200h)</option>
                <option value="fixo">Fixo (mensal)</option>
              </select>
            </div>
            {value.divisor_modo === "fixo" && (
              <Campo label="Divisor fixo (h/mês)" value={value.divisor_fixo ?? 220} onChange={(n) => set({ divisor_fixo: n })} hint="Ex.: 200 ou 220" />
            )}
          </div>

          <h3 className="pt-2 text-sm font-semibold">Regras por nível de escolaridade</h3>
          <p className="text-xs text-muted-foreground">Campos vazios usam a regra geral acima. Tarifa 0 não paga a verba; sem tarifa no nível nem na regra geral, o valor é zero. Prioridade do salário: próprio do profissional › cargo › nível.</p>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-xs text-muted-foreground">
                <tr>
                  {["Nível", "Salário base (R$)", "Grat. escolar. (%)", "Carga sem. (h)", "HE 50% (R$/h)", "HE 100% (R$/h)", "Adic. not. (R$/h)", "Plantão (R$)", "Sobreaviso (R$)", "Insalub. (%)", "Cargos"].map((h) => (
                    <th key={h} className="px-2 py-2 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NIVEIS_ESCOLARIDADE.map(({ k, h }) => {
                  const v = niveis[k] ?? {};
                  const campo = (f: keyof NivelFinanceiro, ph: string, step = "0.01") => (
                    <td className="px-1 py-1"><Input aria-label={`${h} ${f}`} className="h-8 min-w-20" type="number" min={0} step={step} value={v[f] ?? ""} placeholder={ph} onChange={(e) => setNivel(k, { [f]: toNumOrNull(e.target.value) })} /></td>
                  );
                  return (
                    <tr key={k} className="border-t border-border">
                      <td className="px-2 py-1 font-medium">{h}</td>
                      {campo("salario_base", "—")}
                      {campo("gratificacao_pct", "0")}
                      {campo("carga_semanal", "40", "1")}
                      {campo("valor_he50", String(value.valor_he50 ?? 0))}
                      {campo("valor_he100", String(value.valor_he100 ?? 0))}
                      {campo("valor_adn", String(value.valor_adn ?? 0))}
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
        </TabsContent>

        <TabsContent value="tributos" forceMount className="space-y-2 data-[state=inactive]:hidden">
          <p className="text-xs text-muted-foreground">Os valores abaixo não são atualizados automaticamente. Confirme alíquotas e enquadramentos com o RH/Contabilidade.</p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Campo label="Previdência Efetivos – RPPS (%)" value={value.rpps_pct} onChange={(n) => set({ rpps_pct: n })} />
            <Campo label="ISS (%)" value={value.iss_pct} onChange={(n) => set({ iss_pct: n })} hint="Onde incide: escolha abaixo" />
          </div>
          <TributosRegime value={value} set={set} />
          <Bloco titulo={`INSS (${value.inss_faixas.length} faixas)`}>
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
          <DescontosExtras value={value} set={set} />
        </TabsContent>

        <TabsContent value="cargos" forceMount className="space-y-3 data-[state=inactive]:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar cargo" aria-label="Buscar cargo" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="flex gap-1" role="group" aria-label="Filtrar cargos">
              {([["todos", `Todos (${cargos.length})`], ["pendentes", `Sem salário no cargo (${cargos.length - configurados})`], ["configurados", `Configurados (${configurados})`]] as const).map(([k, t]) => (
                <Button key={k} type="button" size="sm" variant={filtro === k ? "default" : "outline"} aria-pressed={filtro === k} onClick={() => setFiltro(k)}>{t}</Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Prioridade: salário próprio do profissional › salário do cargo › piso do nível. Mudanças de nível só gravam ao clicar em Salvar.
          </p>
          <SincronizarCadastro cargos={value.cargos} lista={cargos} niveis={value.niveis} bloqueado={alterado} />

          <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left">Cargo</th>
                  <th className="px-2 py-2 text-left">Nível</th>
                  <th className="px-2 py-2 text-left">Salário base (R$)</th>
                  <th className="px-2 py-2 text-left">Carga sem. (h)</th>
                  <th className="px-2 py-2 text-left">Insalub. (%)</th>
                  <th className="px-2 py-2 text-left">Plantão (R$)</th>
                  <th className="px-2 py-2 text-left" title="HE, adicional noturno, sobreaviso, gratificação e variação ESF">Regras extras / ESF</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => {
                  const v = value.cargos[c.id] ?? {};
                  const s = salarioDe(c);
                  const pend = c.id in niveisPendentes;
                  const nvRef = c.nivel ? niveis[c.nivel as NivelEscolaridade] : undefined;
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-2 py-1">{c.nome}</td>
                      <td className="px-2 py-1">
                        <select className={`h-8 rounded-md border bg-background px-2 text-sm ${pend ? "border-primary" : "border-input"}`} value={c.nivel ?? ""} onChange={(e) => mudarNivelCargo(c.id, e.target.value)} aria-label={`Nível de ${c.nome}`}>
                          <option value="">—</option>
                          {NIVEIS_ESCOLARIDADE.map((n) => <option key={n.k} value={n.k}>{n.h}</option>)}
                        </select>
                        {pend && <span className="ml-1 text-[10px] text-primary">não salvo</span>}
                      </td>
                      <td className="px-2 py-1">
                        <Input className="h-8 min-w-28" type="number" min={0} step="0.01" value={v.salario_base ?? ""} placeholder={s.origem === "nivel" ? `${brl(s.v)} (nível)` : "sem base"} aria-label={`Salário de ${c.nome}`} onChange={(e) => setCargo(c.id, { salario_base: toNumOrNull(e.target.value) })} />
                        {s.origem === "nivel" && <span className="text-[10px] text-muted-foreground">herdado do nível</span>}
                        {s.origem === "nenhum" && <span className="text-[10px] text-destructive">sem base</span>}
                      </td>
                      <td className="px-2 py-1"><Input className="h-8 w-20" type="number" min={0} step="1" value={v.carga_semanal ?? ""} placeholder={String(nvRef?.carga_semanal ?? c.carga_horaria_semanal ?? 40)} aria-label={`Carga de ${c.nome}`} onChange={(e) => setCargo(c.id, { carga_semanal: toNumOrNull(e.target.value) })} /></td>
                      <td className="px-2 py-1">
                        <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={String(v.insalubridade_pct ?? "")} aria-label={`Insalubridade de ${c.nome}`} onChange={(e) => setCargo(c.id, { insalubridade_pct: toNumOrNull(e.target.value) })}>
                          <option value="">{nvRef?.insalubridade_pct ? `Do nível (${nvRef.insalubridade_pct}%)` : "Isento"}</option>
                          <option value="10">10% mínimo</option>
                          <option value="20">20% médio</option>
                          <option value="40">40% máximo</option>
                        </select>
                      </td>
                      <td className="px-2 py-1"><Input className="h-8 w-28" type="number" min={0} step="0.01" value={v.valor_plantao ?? ""} placeholder={String(nvRef?.valor_plantao ?? value.valor_plantao)} aria-label={`Plantão de ${c.nome}`} onChange={(e) => setCargo(c.id, { valor_plantao: toNumOrNull(e.target.value) })} /></td>
                      <td className="px-2 py-1"><CargoRegrasDialog nome={c.nome} value={v} onChange={(patch) => setCargo(c.id, patch)} /></td>
                    </tr>
                  );
                })}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-6 text-center text-xs text-muted-foreground">{carregandoCargos ? "Carregando cargos…" : "Nenhum cargo encontrado."}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="simulador" forceMount className="data-[state=inactive]:hidden">
          <SimuladorFolha params={value} cargos={cargos} niveisPendentes={niveisPendentes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Grava o salário do cargo no "Salário Base" do cadastro de Profissionais (ação opcional, com prévia e confirmação). */
function SincronizarCadastro({ cargos, lista, niveis, bloqueado }: { cargos: Record<string, CargoFinanceiro>; lista: { id: string; nivel: string | null }[]; niveis: ParametrosFinanceiros["niveis"]; bloqueado: boolean }) {
  const qc = useQueryClient();
  const [modo, setModo] = useState<"vazios" | "todos">("vazios");
  const [rodando, setRodando] = useState(false);
  const [previa, setPrevia] = useState<null | { vazios: number; excecoesIguais: number; excecoesDiferentes: number }>(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const resolvidos = lista
    .map((c) => {
      const sc = cargos[c.id]?.salario_base ?? 0;
      if (sc > 0) return { id: c.id, valor: sc, origem: "cargo" as const };
      const sn = (c.nivel && niveis?.[c.nivel as keyof typeof niveis]?.salario_base) || 0;
      return sn > 0 ? { id: c.id, valor: sn, origem: "nivel" as const } : null;
    })
    .filter((x): x is { id: string; valor: number; origem: "cargo" | "nivel" } => !!x);
  const nCargo = resolvidos.filter((r) => r.origem === "cargo").length;
  const nNivel = resolvidos.length - nCargo;

  async function abrirPrevia() {
    if (!resolvidos.length) return toast.error("Nenhum cargo com salário ou nível com piso definido.");
    setCarregandoPrevia(true);
    try {
      const valorPorCargo = new Map(resolvidos.map((r) => [r.id, r.valor]));
      const ids = [...valorPorCargo.keys()];
      let vazios = 0, excecoesIguais = 0, excecoesDiferentes = 0;
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await supabase.from("profissionais").select("cargo_id, salario_base").in("cargo_id", ids.slice(i, i + 100)).is("deleted_at", null);
        if (error) throw error;
        for (const p of data ?? []) {
          const atual = Number(p.salario_base) || 0;
          if (atual <= 0) vazios++;
          else if (atual === valorPorCargo.get(p.cargo_id as string)) excecoesIguais++;
          else excecoesDiferentes++;
        }
      }
      setPrevia({ vazios, excecoesIguais, excecoesDiferentes });
    } catch (e) {
      toast.error(`Não foi possível calcular a prévia: ${(e as Error).message}`);
    } finally {
      setCarregandoPrevia(false);
    }
  }

  async function sincronizar() {
    setRodando(true);
    try {
      // Operação transacional no servidor: grava tudo ou nada (sem atualizações parciais).
      const itens = resolvidos.map((r) => ({ cargo_id: r.id, valor: r.valor }));
      const { data, error } = await (supabase as any).rpc("ff_sincronizar_salarios", { p_modo: modo, p_itens: itens });
      if (error) throw error;
      toast.success(`${Number(data) || 0} profissional(is) atualizado(s) no cadastro.`);
    } catch (e) {
      toast.error(`Sincronização não aplicada: ${(e as Error).message}. Nenhum salário foi alterado.`, { duration: 12000 });
    } finally {
      setRodando(false);
      setPrevia(null);
      qc.invalidateQueries({ queryKey: ["folha-financeira"] });
    }
  }

  const afetados = previa ? (modo === "vazios" ? previa.vazios : previa.vazios + previa.excecoesIguais + previa.excecoesDiferentes) : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-2 text-xs">
      <span className="font-medium">Sincronizar com cadastro de Profissionais:</span>
      <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} aria-label="Modo de sincronização">
        <option value="vazios">Só quem está sem salário</option>
        <option value="todos">Todos (substitui exceções)</option>
      </select>
      <Button type="button" size="sm" variant="outline" disabled={rodando || carregandoPrevia || bloqueado || !resolvidos.length} onClick={abrirPrevia}>
        <RefreshCw className={`mr-1 h-3 w-3 ${rodando || carregandoPrevia ? "animate-spin" : ""}`} />{carregandoPrevia ? "Calculando…" : rodando ? "Sincronizando…" : "Sincronizar…"}
      </Button>
      <span className="text-muted-foreground">{bloqueado ? "Salve a configuração antes de sincronizar." : "Mostra uma prévia antes de gravar."}</span>

      <AlertDialog open={!!previa} onOpenChange={(o) => !o && !rodando && setPrevia(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar sincronização salarial</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Modo: <strong>{modo === "vazios" ? "só profissionais sem salário" : "todos os profissionais dos cargos"}</strong> — {resolvidos.length} cargo(s) ({nCargo} pelo salário do cargo, {nNivel} pelo piso do nível).</p>
                {previa && (
                  <ul className="list-disc space-y-1 pl-5">
                    <li>{previa.vazios} profissional(is) sem salário receberão o valor.</li>
                    <li>{previa.excecoesDiferentes} com salário próprio diferente (exceção individual){modo === "vazios" ? " serão preservados." : <strong className="text-destructive"> terão o valor SUBSTITUÍDO.</strong>}</li>
                    <li>{previa.excecoesIguais} já estão com o mesmo valor.</li>
                  </ul>
                )}
                <p><strong>Total afetado: {afetados}</strong>. Folhas de frequência não são alteradas.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rodando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={rodando || afetados === 0} className={modo === "todos" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={(e) => { e.preventDefault(); void sincronizar(); }}>
              {rodando ? "Gravando…" : `Gravar em ${afetados}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

const REGIME_OPC: { k: RegimeAlvo; h: string }[] = [
  { k: "ambos", h: "Efetivos e Contratados" },
  { k: "efetivos", h: "Só Efetivos" },
  { k: "contratados", h: "Só Contratados" },
  { k: "nenhum", h: "Não aplicar" },
];
const selCls = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

function SelRegime({ v, on }: { v: RegimeAlvo; on: (r: RegimeAlvo) => void }) {
  return (
    <select className={selCls} value={v} onChange={(e) => on(e.target.value as RegimeAlvo)}>
      {REGIME_OPC.map((o) => <option key={o.k} value={o.k}>{o.h}</option>)}
    </select>
  );
}

type SetFn = (patch: Partial<ParametrosFinanceiros>) => void;

function TributosRegime({ value, set }: { value: ParametrosFinanceiros; set: SetFn }) {
  const t = value.tributos ?? DEFAULT_TRIBUTOS;
  const up = (k: keyof typeof t, patch: Record<string, unknown>) => set({ tributos: { ...t, [k]: { ...t[k], ...patch } } as typeof t });
  return (
    <Bloco titulo="Onde cada desconto incide (Efetivos / Contratados)" defaultOpen>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><Label className="text-xs">INSS (tabela progressiva)</Label><SelRegime v={t.inss.regime} on={(r) => up("inss", { regime: r })} /></div>
        <div><Label className="text-xs">RPPS ({value.rpps_pct}%)</Label><SelRegime v={t.rpps.regime} on={(r) => up("rpps", { regime: r })} /></div>
        <div><Label className="text-xs">IRRF</Label><SelRegime v={t.irrf.regime} on={(r) => up("irrf", { regime: r })} /></div>
        <div>
          <Label className="text-xs">ISS ({value.iss_pct}%)</Label>
          <SelRegime v={t.iss.regime} on={(r) => up("iss", { regime: r })} />
          <label className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <input type="checkbox" checked={t.iss.somente_autonomo} onChange={(e) => up("iss", { somente_autonomo: e.target.checked })} />
            Só vínculos RPA/autônomo
          </label>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Se RPPS e INSS valerem para o mesmo regime, usa RPPS. Vínculos RPA/autônomo não têm previdência. A alíquota do ISS fica em Regras de cálculo.</p>
    </Bloco>
  );
}

function DescontosExtras({ value, set }: { value: ParametrosFinanceiros; set: SetFn }) {
  const lista = value.descontos_extras ?? [];
  const up = (id: string, patch: Partial<DescontoExtra>) => set({ descontos_extras: lista.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const novo = () => set({ descontos_extras: [...lista, { id: `d${Date.now()}`, nome: "Novo desconto", forma: "pct_bruto", valor: 0, regime: "ambos", ativo: true }] });
  return (
    <Bloco titulo={`Outros descontos personalizados (${lista.length})`}>
      <div className="space-y-2">
        {lista.length === 0 && <p className="text-xs text-muted-foreground">Nenhum. Use para sindicato, convênios, previdência complementar etc.</p>}
        {lista.map((d) => (
          <div key={d.id} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1.5fr_1.2fr_0.8fr_1.2fr_auto_auto]">
            <div><Label className="text-xs">Nome</Label><Input value={d.nome} onChange={(e) => up(d.id, { nome: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Forma</Label>
              <select className={selCls} value={d.forma} onChange={(e) => up(d.id, { forma: e.target.value as DescontoExtra["forma"] })}>
                <option value="pct_bruto">% sobre o bruto</option>
                <option value="pct_base">% sobre o salário base</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </div>
            <div><Label className="text-xs">{d.forma === "fixo" ? "Valor (R$)" : "Percentual (%)"}</Label><Input type="number" step="0.01" value={d.valor} onChange={(e) => up(d.id, { valor: toNum(e.target.value) })} /></div>
            <div><Label className="text-xs">Aplica em</Label><SelRegime v={d.regime} on={(r) => up(d.id, { regime: r })} /></div>
            <label className="flex h-9 items-center gap-1 text-xs"><input type="checkbox" checked={d.ativo} onChange={(e) => up(d.id, { ativo: e.target.checked })} />Ativo</label>
            <Button type="button" variant="ghost" size="icon" aria-label="Excluir desconto" onClick={() => set({ descontos_extras: lista.filter((x) => x.id !== d.id) })}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={novo}><Plus className="mr-1 h-3 w-3" />Novo desconto</Button>
      </div>
    </Bloco>
  );
}
