/**
 * Relatório Geral Inteligente da Secretaria — módulo independente.
 * NÃO altera regras de negócio, banco, APIs, permissões ou cálculos.
 * Consome apenas dados já existentes via `useGerencial()` + leituras auxiliares.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, Check, ChevronLeft, ChevronRight, FileText, FileSpreadsheet, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader } from "@/components/shared/PageHeader";
import { KpiCard } from "@/components/shared/KpiCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { useGerencial } from "@/hooks/use-gerencial";
import { useUnidadesLookup, useSetoresLookup, useCargosLookup, useFuncoesLookup, useVinculosLookup } from "@/hooks/use-lookups";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/csv-export";
import { exportarPdfInstitucional, exportarExcel, type ExportColumn } from "@/lib/relatorios-gerenciais-export";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { CHART_COLORS } from "@/lib/relatorios-gerenciais-intelligence";
import { PermissionGate } from "@/components/permission-gate";

export const Route = createFileRoute("/_authenticated/relatorio-inteligente")({
  component: RelatorioInteligentePage,
});

/* ============ Tipos e presets ============ */

type TipoRelatorio = "executivo" | "tecnico" | "administrativo" | "rh" | "auditoria" | "personalizado";
type Formato = "pdf-exec" | "pdf-abnt" | "excel" | "csv" | "word";

type BlocoId =
  | "profissionais" | "unidades" | "setores" | "cargos" | "funcoes"
  | "situacao" | "estrutura" | "lotacoes" | "distribuicao" | "indicadores"
  | "piso" | "frequencias" | "folha_efetivos" | "folha_contratados"
  | "competencias" | "pendencias" | "aprovacoes" | "assinaturas"
  | "auditoria" | "notificacoes" | "saude";

const BLOCOS: { id: BlocoId; label: string; grupo: string }[] = [
  { id: "profissionais", label: "Profissionais", grupo: "Cadastros" },
  { id: "unidades", label: "Unidades", grupo: "Cadastros" },
  { id: "setores", label: "Setores", grupo: "Cadastros" },
  { id: "cargos", label: "Cargos", grupo: "Cadastros" },
  { id: "funcoes", label: "Funções", grupo: "Cadastros" },
  { id: "situacao", label: "Situação Funcional", grupo: "Gestão" },
  { id: "estrutura", label: "Estrutura Organizacional", grupo: "Gestão" },
  { id: "lotacoes", label: "Lotações", grupo: "Gestão" },
  { id: "distribuicao", label: "Distribuição dos Profissionais", grupo: "Gestão" },
  { id: "indicadores", label: "Indicadores Gerais", grupo: "Gestão" },
  { id: "piso", label: "Piso da Enfermagem", grupo: "Operacional" },
  { id: "frequencias", label: "Frequências", grupo: "Operacional" },
  { id: "folha_efetivos", label: "Folha Efetivos", grupo: "Operacional" },
  { id: "folha_contratados", label: "Folha Contratados", grupo: "Operacional" },
  { id: "competencias", label: "Competências", grupo: "Operacional" },
  { id: "pendencias", label: "Pendências", grupo: "Gestão" },
  { id: "aprovacoes", label: "Aprovações", grupo: "Gestão" },
  { id: "assinaturas", label: "Assinaturas", grupo: "Gestão" },
  { id: "auditoria", label: "Auditoria", grupo: "Controle" },
  { id: "notificacoes", label: "Notificações", grupo: "Controle" },
  { id: "saude", label: "Saúde do Sistema", grupo: "Controle" },
];

const PRESET_BLOCOS: Record<TipoRelatorio, BlocoId[]> = {
  executivo: ["indicadores", "distribuicao", "estrutura", "pendencias", "auditoria"],
  tecnico: ["profissionais", "unidades", "setores", "cargos", "funcoes", "estrutura", "distribuicao", "indicadores"],
  administrativo: ["unidades", "setores", "pendencias", "aprovacoes", "assinaturas", "notificacoes"],
  rh: ["profissionais", "situacao", "lotacoes", "cargos", "funcoes", "distribuicao"],
  auditoria: ["auditoria", "pendencias", "saude"],
  personalizado: [],
};

type Filtros = {
  secretariaId: string;
  unidadeId: string;
  setorId: string;
  cargoId: string;
  funcaoId: string;
  vinculoId: string;
  status: string;
  sexo: string;
  faixaEtaria: string;
  escolaridade: string;
  admissaoDe: string;
  admissaoAte: string;
  tempoServico: string;
  periodoDe: string;
  periodoAte: string;
  competencia: string;
  diretor: string;
  coordenador: string;
  cnes: string;
  tipoUnidade: string;
  soInconsistencias: boolean;
  soAtivos: boolean;
  soAfastados: boolean;
  soFerias: boolean;
  soLicenca: boolean;
  soContratados: boolean;
  soEfetivos: boolean;
};

const FILTROS_INICIAIS: Filtros = {
  secretariaId: "", unidadeId: "", setorId: "", cargoId: "", funcaoId: "", vinculoId: "",
  status: "", sexo: "", faixaEtaria: "", escolaridade: "",
  admissaoDe: "", admissaoAte: "", tempoServico: "", periodoDe: "", periodoAte: "",
  competencia: "", diretor: "", coordenador: "", cnes: "", tipoUnidade: "",
  soInconsistencias: false, soAtivos: false, soAfastados: false, soFerias: false,
  soLicenca: false, soContratados: false, soEfetivos: false,
};

/* ============ Componente principal ============ */

function RelatorioInteligentePage() {
  return (
    <PermissionGate permission="relatorio.visualizar">
      <div className="space-y-4 p-4">
        <PageHeader
          title="⭐ Relatório Geral Inteligente"
          description="Gera relatórios personalizados a partir de dados reais — com IA gerencial, pareceres, indicadores, gráficos e alertas automáticos."
        />
        <Wizard />
      </div>
    </PermissionGate>
  );
}

function Wizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tipo, setTipo] = useState<TipoRelatorio>("executivo");
  const [blocos, setBlocos] = useState<BlocoId[]>(PRESET_BLOCOS.executivo);
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIAIS);
  const [formato, setFormato] = useState<Formato>("pdf-exec");
  const [gerando, setGerando] = useState(false);

  function escolherTipo(t: TipoRelatorio) {
    setTipo(t);
    setBlocos(PRESET_BLOCOS[t].length ? PRESET_BLOCOS[t] : blocos);
  }
  function toggleBloco(id: BlocoId) {
    setBlocos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-4">
      <Stepper step={step} />
      <div className="rounded-lg border bg-card p-4">
        {step === 1 && <Step1 tipo={tipo} onChange={escolherTipo} />}
        {step === 2 && <Step2 blocos={blocos} toggle={toggleBloco} tipo={tipo} />}
        {step === 3 && <Step3 filtros={filtros} onChange={setFiltros} />}
        {step === 4 && <Step4 tipo={tipo} blocos={blocos} filtros={filtros} formato={formato} setFormato={setFormato} gerando={gerando} setGerando={setGerando} />}
      </div>
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} disabled={step === 1}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        {step < 4 ? (
          <Button onClick={() => setStep((s) => (s + 1) as 2 | 3 | 4)} disabled={step === 2 && blocos.length === 0}>
            Avançar <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const rotulos = ["Tipo", "Blocos", "Filtros", "Prévia & Formato"];
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {rotulos.map((r, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={r} className={"flex items-center gap-2 rounded-full border px-3 py-1 " + (active ? "border-primary bg-primary/10 font-semibold text-primary" : done ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "text-muted-foreground")}>
            {done ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{n}</span>}
            {r}
          </li>
        );
      })}
    </ol>
  );
}

/* ============ Etapa 1 ============ */

function Step1({ tipo, onChange }: { tipo: TipoRelatorio; onChange: (t: TipoRelatorio) => void }) {
  const opts: { value: TipoRelatorio; label: string; desc: string }[] = [
    { value: "executivo", label: "Relatório Executivo", desc: "Visão de alto nível para o Secretário — semáforo, indicadores e pareceres." },
    { value: "tecnico", label: "Relatório Técnico", desc: "Detalhado, ABNT, com tabelas completas e integridade cadastral." },
    { value: "administrativo", label: "Relatório Administrativo", desc: "Rotinas administrativas: unidades, pendências, assinaturas." },
    { value: "rh", label: "Relatório de RH", desc: "Foco em profissionais, lotação, cargos e situação funcional." },
    { value: "auditoria", label: "Relatório de Auditoria", desc: "Trilha de auditoria, pendências e saúde do sistema." },
    { value: "personalizado", label: "Relatório Personalizado", desc: "Você escolhe todos os blocos manualmente." },
  ];
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Etapa 1 · Tipo de relatório</h2>
      <RadioGroup value={tipo} onValueChange={(v) => onChange(v as TipoRelatorio)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {opts.map((o) => (
          <label key={o.value} htmlFor={`t-${o.value}`} className={"cursor-pointer rounded-md border p-3 transition-colors " + (tipo === o.value ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
            <div className="flex items-start gap-2">
              <RadioGroupItem id={`t-${o.value}`} value={o.value} className="mt-1" />
              <div>
                <div className="text-sm font-semibold">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.desc}</div>
              </div>
            </div>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

/* ============ Etapa 2 ============ */

function Step2({ blocos, toggle, tipo }: { blocos: BlocoId[]; toggle: (id: BlocoId) => void; tipo: TipoRelatorio }) {
  const grupos = useMemo(() => {
    const m = new Map<string, typeof BLOCOS>();
    for (const b of BLOCOS) {
      const arr = m.get(b.grupo) ?? [];
      arr.push(b);
      m.set(b.grupo, arr);
    }
    return Array.from(m.entries());
  }, []);
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">
        Etapa 2 · Blocos a incluir <span className="ml-2 rounded bg-muted px-2 py-0.5 text-[10px]">{blocos.length} selecionado(s)</span>
        <span className="ml-2 text-[10px] font-normal text-muted-foreground/80">preset: {tipo}</span>
      </h2>
      {grupos.map(([grupo, itens]) => (
        <div key={grupo}>
          <div className="mb-1 text-xs font-semibold text-muted-foreground">{grupo}</div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {itens.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
                <Checkbox checked={blocos.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
                {b.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============ Etapa 3 ============ */

function Step3({ filtros, onChange }: { filtros: Filtros; onChange: (f: Filtros) => void }) {
  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => onChange({ ...filtros, [k]: v });
  const unidades = useUnidadesLookup();
  const setores = useSetoresLookup();
  const cargos = useCargosLookup();
  const funcoes = useFuncoesLookup();
  const vinculos = useVinculosLookup();

  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>
  );
  const Sel = ({ value, onChange: on, options, placeholder = "Todos" }: { value: string; onChange: (v: string) => void; options: { id: string; nome: string }[]; placeholder?: string }) => (
    <Select value={value || "__all__"} onValueChange={(v) => on(v === "__all__" ? "" : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">{placeholder}</SelectItem>
        {options.map((o) => (<SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>))}
      </SelectContent>
    </Select>
  );
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 3 · Filtros gerais</h2>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <F label="Unidade"><Sel value={filtros.unidadeId} onChange={(v) => set("unidadeId", v)} options={unidades.data ?? []} /></F>
        <F label="Setor"><Sel value={filtros.setorId} onChange={(v) => set("setorId", v)} options={setores.data ?? []} /></F>
        <F label="Cargo"><Sel value={filtros.cargoId} onChange={(v) => set("cargoId", v)} options={cargos.data ?? []} /></F>
        <F label="Função"><Sel value={filtros.funcaoId} onChange={(v) => set("funcaoId", v)} options={funcoes.data ?? []} /></F>
        <F label="Vínculo"><Sel value={filtros.vinculoId} onChange={(v) => set("vinculoId", v)} options={vinculos.data ?? []} /></F>
        <F label="Status">
          <Select value={filtros.status || "__all__"} onValueChange={(v) => set("status", v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {["ativo", "afastado", "ferias", "licenciado", "inativo", "desligado"].map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
            </SelectContent>
          </Select>
        </F>
        <F label="Sexo">
          <Select value={filtros.sexo || "__all__"} onValueChange={(v) => set("sexo", v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Feminino</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Faixa etária">
          <Select value={filtros.faixaEtaria || "__all__"} onValueChange={(v) => set("faixaEtaria", v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {["< 25", "25–34", "35–44", "45–54", "55–64", "65+"].map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>
        </F>
        <F label="Admissão de"><Input type="date" value={filtros.admissaoDe} onChange={(e) => set("admissaoDe", e.target.value)} /></F>
        <F label="Admissão até"><Input type="date" value={filtros.admissaoAte} onChange={(e) => set("admissaoAte", e.target.value)} /></F>
        <F label="Período de"><Input type="date" value={filtros.periodoDe} onChange={(e) => set("periodoDe", e.target.value)} /></F>
        <F label="Período até"><Input type="date" value={filtros.periodoAte} onChange={(e) => set("periodoAte", e.target.value)} /></F>
        <F label="Competência (YYYY-MM)"><Input placeholder="2026-01" value={filtros.competencia} onChange={(e) => set("competencia", e.target.value)} /></F>
        <F label="CNES"><Input value={filtros.cnes} onChange={(e) => set("cnes", e.target.value)} placeholder="Ex.: 1234567" /></F>
        <F label="Diretor (nome contém)"><Input value={filtros.diretor} onChange={(e) => set("diretor", e.target.value)} /></F>
        <F label="Coordenador (nome contém)"><Input value={filtros.coordenador} onChange={(e) => set("coordenador", e.target.value)} /></F>
        <F label="Tipo de Unidade"><Input value={filtros.tipoUnidade} onChange={(e) => set("tipoUnidade", e.target.value)} placeholder="ex.: UBS, Hospital, CAPS" /></F>
        <F label="Escolaridade"><Input value={filtros.escolaridade} onChange={(e) => set("escolaridade", e.target.value)} /></F>
        <F label="Tempo de serviço">
          <Select value={filtros.tempoServico || "__all__"} onValueChange={(v) => set("tempoServico", v === "__all__" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {["< 1 ano", "1–4 anos", "5–9 anos", "10–19 anos", "20–29 anos", "30+ anos"].map((f) => (<SelectItem key={f} value={f}>{f}</SelectItem>))}
            </SelectContent>
          </Select>
        </F>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold text-muted-foreground">Escopo rápido</div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ["soInconsistencias", "Somente inconsistências"],
            ["soAtivos", "Somente ativos"],
            ["soAfastados", "Somente afastados"],
            ["soFerias", "Somente férias"],
            ["soLicenca", "Somente licença"],
            ["soContratados", "Somente contratados"],
            ["soEfetivos", "Somente efetivos"],
          ] as const).map(([k, l]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50">
              <Checkbox checked={filtros[k]} onCheckedChange={(c) => set(k, Boolean(c))} />
              {l}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============ Etapa 4 — Prévia + Geração ============ */

function useDadosAuxiliares() {
  return useQuery({
    queryKey: ["rel-inteligente-aux"],
    staleTime: 60_000,
    queryFn: async () => {
      const [pend, aprov, sig, notif, freq] = await Promise.all([
        supabase.from("pendencias").select("id, status, prioridade, aberta_em, prazo, sla_horas").is("deleted_at", null).limit(2000),
        supabase.from("frequencia_aprovacoes").select("id, status, decidido_em").limit(2000),
        supabase.from("assinaturas_institucionais").select("id, status").limit(2000),
        supabase.from("notificacoes").select("id, lida, tipo, created_at").limit(2000),
        supabase.from("frequencias").select("id, competencia_id, status, total_horas_extras, total_faltas").limit(2000),
      ]);
      return {
        pendencias: pend.data ?? [],
        aprovacoes: aprov.data ?? [],
        assinaturas: sig.data ?? [],
        notificacoes: notif.data ?? [],
        frequencias: freq.data ?? [],
      };
    },
  });
}

type Analise = ReturnType<typeof gerarAnalise>;

function gerarAnalise(a: NonNullable<ReturnType<typeof useGerencial>["data"]>, aux: NonNullable<ReturnType<typeof useDadosAuxiliares>["data"]>, blocos: BlocoId[]) {
  const total = a.totais.profissionais;
  const status = a.status;
  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  const ativosPct = pct(status["ativo"] ?? 0, total);
  const semLotacao = a.pendencias.semUnidade;
  const incompletos = [a.pendencias.semCpf, a.pendencias.semMatricula, a.pendencias.semTelefone, a.pendencias.semEmail, a.pendencias.semNascimento].reduce((s, n) => s + n, 0);
  const integridade = a.qualidade.integridadeCadastral;

  const topUnidade = a.rankings.maioresUnidades[0];
  const concentracaoTop = topUnidade ? pct(topUnidade.valor, total) : 0;

  const pendAbertas = aux.pendencias.filter((p) => ["aberta", "em_analise", "aguardando_resposta", "reaberta", "respondida"].includes(String(p.status))).length;

  // Score geral 0..100 (composição ponderada)
  const scores: { chave: string; peso: number; valor: number }[] = [
    { chave: "cadastros", peso: 0.20, valor: a.qualidade.integridadeCadastral },
    { chave: "lotacoes", peso: 0.15, valor: a.qualidade.lotacao },
    { chave: "responsaveis", peso: 0.15, valor: a.qualidade.coberturaResponsaveis },
    { chave: "estrutura", peso: 0.15, valor: a.qualidade.estruturaOrganizacional },
    { chave: "pendencias", peso: 0.15, valor: pendAbertas === 0 ? 100 : Math.max(0, 100 - Math.min(100, pendAbertas * 2)) },
    { chave: "unidades", peso: 0.10, valor: pct(a.totais.unidades - a.unidadesPend.semDiretor, a.totais.unidades) },
    { chave: "setores", peso: 0.05, valor: pct(a.totais.setores - a.setoresPend.semCoordenador, Math.max(1, a.totais.setores)) },
    { chave: "auditoria", peso: 0.05, valor: 100 }, // presença de auditoria (existe)
  ];
  const scoreGeral = Math.round(scores.reduce((s, x) => s + x.valor * x.peso, 0) * 10) / 10;
  const semaforo: "verde" | "amarelo" | "vermelho" = scoreGeral >= 90 ? "verde" : scoreGeral >= 75 ? "amarelo" : "vermelho";

  const pareceres: string[] = [];
  pareceres.push(`A Secretaria possui atualmente ${total.toLocaleString("pt-BR")} profissional(is) cadastrado(s).`);
  pareceres.push(`${ativosPct.toFixed(1)}% encontram-se ativos (${(status["ativo"] ?? 0).toLocaleString("pt-BR")}).`);
  if (a.unidadesPend.semDiretor) pareceres.push(`Existem ${a.unidadesPend.semDiretor} unidade(s) sem diretor.`);
  if (a.setoresPend.semCoordenador) pareceres.push(`${a.setoresPend.semCoordenador} setor(es) estão sem coordenador.`);
  if (semLotacao) pareceres.push(`${semLotacao} profissional(is) sem lotação de unidade.`);
  if (a.pendencias.semCargo) pareceres.push(`${a.pendencias.semCargo} profissional(is) sem cargo definido.`);
  if (a.pendencias.semFuncao) pareceres.push(`${a.pendencias.semFuncao} profissional(is) sem função definida.`);
  if (incompletos) pareceres.push(`${incompletos} campo(s) cadastrais incompletos no total (CPF/matrícula/telefone/e-mail/nascimento).`);
  if (pendAbertas) pareceres.push(`Foram identificadas ${pendAbertas} pendência(s) administrativa(s) abertas.`);
  pareceres.push(`O índice de integridade cadastral da rede é de ${integridade.toFixed(1)}%.`);
  if (topUnidade && concentracaoTop >= 25) pareceres.push(`A distribuição de profissionais demonstra concentração no ${topUnidade.nome}, representando ${concentracaoTop.toFixed(1)}% do quadro total.`);
  if (semLotacao && (status["ativo"] ?? 0) > 0) pareceres.push(`Existem profissionais com vínculo ativo porém sem setor/unidade definidos — recomenda-se regularização.`);
  const compAudit = a.comparativos.find((c) => c.chave === "audit-30d");
  if (compAudit && compAudit.deltaPct != null && Math.abs(compAudit.deltaPct) >= 10) {
    pareceres.push(`Atividade de auditoria ${compAudit.delta >= 0 ? "aumentou" : "reduziu"} ${Math.abs(compAudit.deltaPct).toFixed(1)}% em relação ao período anterior.`);
  }

  const alertas: { nivel: "vermelho" | "amarelo"; titulo: string; qtd?: number }[] = [];
  if (a.unidadesPend.semDiretor) alertas.push({ nivel: "vermelho", titulo: "Unidade sem Diretor", qtd: a.unidadesPend.semDiretor });
  if (a.setoresPend.semCoordenador) alertas.push({ nivel: "amarelo", titulo: "Setor sem Coordenador", qtd: a.setoresPend.semCoordenador });
  if (semLotacao) alertas.push({ nivel: "amarelo", titulo: "Profissional sem Lotação", qtd: semLotacao });
  if (a.pendencias.semCargo) alertas.push({ nivel: "amarelo", titulo: "Profissional sem Cargo", qtd: a.pendencias.semCargo });
  if (incompletos) alertas.push({ nivel: "amarelo", titulo: "Cadastro Incompleto", qtd: incompletos });
  if (a.unidadesPend.semCnes) alertas.push({ nivel: "vermelho", titulo: "Unidade sem CNES", qtd: a.unidadesPend.semCnes });
  if ((status["inativo"] ?? 0) + (status["desligado"] ?? 0)) alertas.push({ nivel: "amarelo", titulo: "Profissionais Inativos", qtd: (status["inativo"] ?? 0) + (status["desligado"] ?? 0) });
  if (pendAbertas) alertas.push({ nivel: "amarelo", titulo: "Pendências Administrativas", qtd: pendAbertas });

  // Contagem para prévia
  const tabelas = blocos.filter((b) => ["profissionais", "unidades", "setores", "cargos", "funcoes", "piso", "pendencias", "auditoria", "situacao", "lotacoes", "distribuicao"].includes(b)).length;
  const graficos = 2 + blocos.filter((b) => ["distribuicao", "indicadores", "rh", "piso", "frequencias", "estrutura"].includes(b)).length + 4;
  const paginas = Math.max(6, 3 + blocos.length + Math.ceil(tabelas * 1.5));

  return {
    scoreGeral, semaforo, scores, pareceres, alertas, integridade,
    contadores: {
      paginas, graficos: Math.min(24, graficos), tabelas, indicadores: 15, pareceres: pareceres.length,
      profissionais: total, unidades: a.totais.unidades, setores: a.totais.setores,
    },
    pendAbertas, incompletos,
  };
}

function Step4({ tipo, blocos, filtros, formato, setFormato, gerando, setGerando }: {
  tipo: TipoRelatorio; blocos: BlocoId[]; filtros: Filtros; formato: Formato;
  setFormato: (f: Formato) => void; gerando: boolean; setGerando: (b: boolean) => void;
}) {
  const ger = useGerencial();
  const aux = useDadosAuxiliares();

  if (ger.isLoading || aux.isLoading || !ger.data || !aux.data) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Analisando dados reais da Secretaria…
      </div>
    );
  }
  if (ger.isError) return <EmptyState title="Falha ao carregar dados" description={String((ger.error as Error)?.message ?? "")} />;

  const analise = gerarAnalise(ger.data, aux.data, blocos);

  async function gerar() {
    setGerando(true);
    try {
      const filtrosResumo = buildFiltrosResumo(filtros);
      const linhas = buildLinhasProfissionais(ger.data!);
      const colunas: ExportColumn<Record<string, string | number>>[] = [
        { header: "Unidade", value: (r) => r.unidade },
        { header: "Profissionais", value: (r) => r.qtd, width: 14 },
        { header: "Ativos", value: (r) => r.ativos, width: 12 },
        { header: "Afastados", value: (r) => r.afastados, width: 12 },
        { header: "Férias", value: (r) => r.ferias, width: 12 },
      ];
      const titulo = `Relatório Geral Inteligente — ${rotuloTipo(tipo)}`;
      const subtitulo = `Blocos: ${blocos.length} · Score Geral: ${analise.scoreGeral}% (${analise.semaforo.toUpperCase()}) · Gerado em ${new Date().toLocaleString("pt-BR")}`;
      const resumo = [
        ...analise.pareceres,
        "",
        `Filtros aplicados: ${filtrosResumo || "nenhum"}`,
        `Alertas ativos: ${analise.alertas.length}`,
      ];
      if (formato === "pdf-exec" || formato === "pdf-abnt" || formato === "word") {
        await exportarPdfInstitucional({
          filename: `relatorio-inteligente-${tipo}-${new Date().toISOString().slice(0, 10)}`,
          titulo, subtitulo, resumo, colunas, linhas,
        });
        toast.success(formato === "word" ? "PDF gerado (compatível para importar em Word)." : "PDF institucional gerado.");
      } else if (formato === "excel") {
        exportarExcel({
          filename: `relatorio-inteligente-${tipo}-${new Date().toISOString().slice(0, 10)}`,
          sheet: "Relatório", colunas, linhas,
        });
        toast.success("Excel gerado.");
      } else {
        downloadCsv(
          `relatorio-inteligente-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`,
          linhas,
          colunas.map((c) => ({ header: c.header, value: c.value })),
        );
        toast.success("CSV gerado.");
      }
    } catch (e) {
      toast.error("Falha ao gerar: " + String((e as Error)?.message ?? e));
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase text-muted-foreground">Etapa 4 · Prévia inteligente & geração</h2>

      <PreviewCounters c={analise.contadores} />
      <ScoreCard score={analise.scoreGeral} semaforo={analise.semaforo} scores={analise.scores} />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border-l-4 border-primary/70 bg-primary/5 p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Parecer Executivo (IA gerencial)
          </div>
          <ul className="space-y-1 text-sm">
            {analise.pareceres.map((p, i) => (<li key={i}>• {p}</li>))}
          </ul>
        </div>

        <div className="rounded-md border bg-card p-3">
          <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Alertas da Gestão</div>
          {analise.alertas.length === 0 ? (
            <div className="text-sm text-emerald-700"><CheckCircle2 className="mr-1 inline h-4 w-4" /> Nenhum alerta detectado.</div>
          ) : (
            <ul className="space-y-1 text-sm">
              {analise.alertas.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={a.nivel === "vermelho" ? "text-red-600" : "text-amber-600"}>
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  {a.titulo}
                  {a.qtd != null && <span className="ml-auto rounded bg-muted px-2 text-xs">{a.qtd}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <IndicadoresGrid a={ger.data} pendAbertas={analise.pendAbertas} />

      <div className="grid gap-3 lg:grid-cols-2">
        <MiniChart title="Profissionais por Unidade (top 20)" data={ger.data.distribuicoes.porUnidade} />
        <MiniChart title="Profissionais por Setor (top 20)" data={ger.data.distribuicoes.porSetor} />
        <MiniChart title="Cargos mais utilizados" data={ger.data.distribuicoes.porCargo} color="#F59E0B" />
        <MiniPie title="Distribuição por Vínculo" data={ger.data.distribuicoes.porVinculo} />
        <MiniChart title="Faixa Etária" data={ger.data.distribuicoes.porFaixaEtaria} color="#10B981" />
        <MiniChart title="Tempo de Serviço" data={ger.data.distribuicoes.porTempoServico} color="#14B8A6" />
      </div>

      <IntegridadeCard a={ger.data} incompletos={analise.incompletos} />

      <div className="rounded-md border bg-card p-3">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Formato de saída</div>
        <RadioGroup value={formato} onValueChange={(v) => setFormato(v as Formato)} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {([
            ["pdf-exec", "PDF Executivo"],
            ["pdf-abnt", "PDF Técnico ABNT"],
            ["excel", "Excel"],
            ["csv", "CSV"],
            ["word", "Word (PDF compatível)"],
          ] as const).map(([v, l]) => (
            <label key={v} className={"cursor-pointer rounded-md border p-2 text-sm " + (formato === v ? "border-primary bg-primary/5" : "hover:bg-muted/50")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`f-${v}`} />
                <label htmlFor={`f-${v}`}>{l}</label>
              </div>
            </label>
          ))}
        </RadioGroup>
        <div className="mt-3 flex justify-end">
          <Button onClick={gerar} disabled={gerando}>
            {gerando ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            Gerar Relatório
          </Button>
        </div>
      </div>
    </div>
  );
}

function rotuloTipo(t: TipoRelatorio) {
  return { executivo: "Executivo", tecnico: "Técnico ABNT", administrativo: "Administrativo", rh: "RH", auditoria: "Auditoria", personalizado: "Personalizado" }[t];
}

function buildFiltrosResumo(f: Filtros): string {
  const out: string[] = [];
  const push = (k: string, v: unknown) => { if (v && String(v).length) out.push(`${k}=${v}`); };
  push("unidade", f.unidadeId); push("setor", f.setorId); push("cargo", f.cargoId); push("funcao", f.funcaoId);
  push("vinculo", f.vinculoId); push("status", f.status); push("sexo", f.sexo); push("faixa", f.faixaEtaria);
  push("admissao", (f.admissaoDe || f.admissaoAte) ? `${f.admissaoDe}..${f.admissaoAte}` : "");
  push("periodo", (f.periodoDe || f.periodoAte) ? `${f.periodoDe}..${f.periodoAte}` : "");
  push("competencia", f.competencia); push("cnes", f.cnes); push("tipoUnidade", f.tipoUnidade);
  if (f.soInconsistencias) out.push("apenas-inconsistencias");
  if (f.soAtivos) out.push("apenas-ativos");
  if (f.soAfastados) out.push("apenas-afastados");
  if (f.soFerias) out.push("apenas-ferias");
  if (f.soLicenca) out.push("apenas-licenca");
  if (f.soContratados) out.push("apenas-contratados");
  if (f.soEfetivos) out.push("apenas-efetivos");
  return out.join(" · ");
}

function buildLinhasProfissionais(a: NonNullable<ReturnType<typeof useGerencial>["data"]>) {
  return a.distribuicoes.porUnidade.map((r) => {
    const afastMatch = a.rankings.unidadesMaisAfastados.find((u) => u.nome === r.nome);
    const feriasMatch = a.rankings.unidadesMaisFerias.find((u) => u.nome === r.nome);
    return {
      unidade: r.nome,
      qtd: r.qtd,
      ativos: Math.max(0, r.qtd - (afastMatch?.valor ?? 0) - (feriasMatch?.valor ?? 0)),
      afastados: afastMatch?.valor ?? 0,
      ferias: feriasMatch?.valor ?? 0,
    };
  });
}

/* ============ blocos visuais ============ */

function PreviewCounters({ c }: { c: Analise["contadores"] }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Seu relatório possuirá</div>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-8">
        {[
          ["Páginas", c.paginas], ["Gráficos", c.graficos], ["Tabelas", c.tabelas], ["Indicadores", c.indicadores],
          ["Pareceres", c.pareceres], ["Profissionais", c.profissionais.toLocaleString("pt-BR")],
          ["Unidades", c.unidades], ["Setores", c.setores],
        ].map(([l, v]) => (
          <div key={String(l)} className="rounded border bg-card p-2 text-center">
            <div className="text-lg font-semibold tabular-nums">{String(v)}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{String(l)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCard({ score, semaforo, scores }: { score: number; semaforo: "verde" | "amarelo" | "vermelho"; scores: { chave: string; peso: number; valor: number }[] }) {
  const cor = semaforo === "verde" ? "#10B981" : semaforo === "amarelo" ? "#F59E0B" : "#EF4444";
  const size = 140, stroke = 14, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, score) / 100);
  return (
    <div className="grid gap-3 rounded-md border bg-card p-3 lg:grid-cols-3">
      <div className="flex flex-col items-center justify-center">
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
          <circle cx={size / 2} cy={size / 2} r={r} stroke={cor} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
        </svg>
        <div className="-mt-24 text-center">
          <div className="text-3xl font-bold tabular-nums" style={{ color: cor }}>{score}%</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Índice Geral da Gestão</div>
        </div>
        <div className={"mt-16 rounded-full px-3 py-0.5 text-xs font-bold " + (semaforo === "verde" ? "bg-emerald-100 text-emerald-700" : semaforo === "amarelo" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
          {semaforo.toUpperCase()}
        </div>
      </div>
      <div className="lg:col-span-2">
        <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Composição do Score</div>
        <ul className="space-y-1 text-xs">
          {scores.map((s) => (
            <li key={s.chave}>
              <div className="mb-0.5 flex justify-between capitalize"><span>{s.chave} <span className="text-muted-foreground">· peso {Math.round(s.peso * 100)}%</span></span><span className="tabular-nums">{s.valor.toFixed(1)}%</span></div>
              <div className="h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, s.valor)}%`, background: cor }} /></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function IndicadoresGrid({ a, pendAbertas }: { a: NonNullable<ReturnType<typeof useGerencial>["data"]>; pendAbertas: number }) {
  const s = a.status;
  const t = a.totais;
  const items: [string, number | string, ("success" | "warning" | "danger" | "default")?][] = [
    ["Total Profissionais", t.profissionais],
    ["Ativos", s["ativo"] ?? 0, "success"],
    ["Afastados", s["afastado"] ?? 0, "warning"],
    ["Licenças", s["licenciado"] ?? 0],
    ["Férias", s["ferias"] ?? 0],
    ["Unidades", t.unidades],
    ["Setores", t.setores],
    ["Cargos", t.cargos],
    ["Sem lotação", a.pendencias.semUnidade, a.pendencias.semUnidade ? "warning" : "success"],
    ["Sem cargo", a.pendencias.semCargo],
    ["Sem função", a.pendencias.semFuncao],
    ["Sem matrícula", a.pendencias.semMatricula],
    ["Sem CPF", a.pendencias.semCpf, a.pendencias.semCpf ? "danger" : "success"],
    ["Sem telefone", a.pendencias.semTelefone],
    ["Sem e-mail", a.pendencias.semEmail],
    ["Un. sem CNES", a.unidadesPend.semCnes, a.unidadesPend.semCnes ? "danger" : "success"],
    ["Un. sem Diretor", a.unidadesPend.semDiretor, a.unidadesPend.semDiretor ? "danger" : "success"],
    ["Set. sem Coord.", a.setoresPend.semCoordenador, a.setoresPend.semCoordenador ? "warning" : "success"],
    ["Pendências abertas", pendAbertas, pendAbertas ? "warning" : "success"],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map(([l, v, tone]) => (
        <KpiCard key={String(l)} label={String(l)} value={typeof v === "number" ? v.toLocaleString("pt-BR") : v} tone={tone} />
      ))}
    </div>
  );
}

function IntegridadeCard({ a, incompletos }: { a: NonNullable<ReturnType<typeof useGerencial>["data"]>; incompletos: number }) {
  const total = a.totais.profissionais;
  const completosPct = a.qualidade.integridadeCadastral;
  const incompletosPct = Math.max(0, 100 - completosPct);
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase text-muted-foreground">Integridade Cadastral</div>
        <div className="text-xs text-muted-foreground">{total.toLocaleString("pt-BR")} profissionais analisados · {incompletos} campo(s) incompletos</div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-xs">Cadastros completos · <span className="font-semibold text-emerald-700">{completosPct.toFixed(1)}%</span></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-emerald-500" style={{ width: `${completosPct}%` }} /></div>
          <div className="mt-2 mb-1 text-xs">Cadastros incompletos · <span className="font-semibold text-red-700">{incompletosPct.toFixed(1)}%</span></div>
          <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-red-500" style={{ width: `${incompletosPct}%` }} /></div>
        </div>
        <ul className="grid grid-cols-2 gap-1 text-xs">
          {a.qualidade.metricas.map((m) => (
            <li key={m.chave} className="flex items-center justify-between rounded border p-1.5">
              <span>{m.rotulo}</span>
              <span className={"tabular-nums " + (m.percentual >= 90 ? "text-emerald-700" : m.percentual >= 75 ? "text-amber-700" : "text-red-700")}>{m.percentual}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MiniChart({ title, data, color = "#6366F1" }: { title: string; data: { nome: string; qtd: number }[]; color?: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-1 text-xs font-semibold">{title}</div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
            <XAxis type="number" /><YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 10 }} />
            <Tooltip /><Bar dataKey="qtd" fill={color} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniPie({ title, data }: { title: string; data: { nome: string; qtd: number }[] }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-1 text-xs font-semibold">{title}</div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} nameKey="nome" dataKey="qtd" outerRadius={80} label={{ fontSize: 10 }}>
              {data.map((_, i) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} /><Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// FileText/FileSpreadsheet referenced for tree-shaking clarity
void FileText; void FileSpreadsheet;
