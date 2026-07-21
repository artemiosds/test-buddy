import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarFolhaContratados,
  salvarFolhaContratados,
  enviarFolhaContratados,
} from "@/lib/frequencias-contratados.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Save, Send, Search, FileSpreadsheet, FileDown, Download,
  Palmtree, HeartPulse, AlertOctagon, Ban, ArrowRightLeft, Filter as FilterIcon,
} from "lucide-react";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import type { Database } from "@/integrations/supabase/types";
import { gerarExcelFolhaContratados, type ItemContratado } from "@/lib/excel-folha-contratados";
import { gerarFolhaContratadosOficial } from "@/lib/pdf-folha-contratados-oficial";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useConferenciaProfissionais, mergeConferencia } from "@/hooks/use-conferencia";
import {
  SituacaoResumo, SituacaoFilter, ProfissionalNomeCell, SituacaoBadge,
  DossieDrawer, type SituacaoFilterValue,
} from "@/components/shared/gerencial";
import {
  contarSituacoes, derivarSituacao, type ProfConferencia,
} from "@/lib/situacao-funcional";
import {
  ErpGridProvider, ErpTbody, NumberCell, TextCell,
  KpiFolhaBar, InconsistenciasPanel, frozenLeftMap, type FrozenCol,
} from "@/components/erp-grid";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type LinhaState = {
  profissional_id: string;
  status: StatusFreq;
  dias_falta: number;
  atestado: number;
  he_50: number;
  he_100: number;
  adn: number;
  plantoes: number;
  sobreaviso: number;
  incentivo: number;
  observacoes: string;
  _dirty?: boolean;
};

const CAMPOS_NUM = ["dias_falta","atestado","he_50","he_100","adn","plantoes","sobreaviso","incentivo"] as const;

export function FrequenciasContratadosPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const { data: compAtiva } = useCompetenciaAtiva();

  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [busca, setBusca] = useState("");
  const [cargoFilter, setCargoFilter] = useState<string>("todos");
  const [funcaoFilter, setFuncaoFilter] = useState<string>("todos");
  const [setorFilter, setSetorFilter] = useState<string>("todos");
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilterValue>("todas");
  const [pendFilter, setPendFilter] = useState<
    "todos" | "sem_conta" | "sem_cargo" | "sem_lotacao" | "sem_matricula" | "sem_cpf"
  >("todos");
  const [dossieProf, setDossieProf] = useState<ProfConferencia | null>(null);
  const [dossieOpen, setDossieOpen] = useState(false);

  const { data: cargosOpts } = useQuery({
    queryKey: ["cargos-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("cargos").select("id, nome")
        .is("deleted_at", null).eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });
  const { data: funcoesOpts } = useQuery({
    queryKey: ["funcoes-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("funcoes").select("id, nome")
        .is("deleted_at", null).eq("status", "ativa").order("nome");
      return data ?? [];
    },
  });
  const { data: setoresOpts } = useQuery({
    queryKey: ["setores-filter", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data } = await supabase.from("setores").select("id, nome")
        .eq("unidade_id", unidadeId).is("deleted_at", null).order("nome");
      return data ?? [];
    },
  });
  useEffect(() => { setSetorFilter("todos"); }, [unidadeId]);

  // Competências
  const { data: competencias } = useQuery({
    queryKey: ["comps-contratados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!competenciaId && compAtiva?.id) setCompetenciaId(compAtiva.id);
    else if (!competenciaId && competencias?.length) setCompetenciaId(competencias[0].id);
  }, [compAtiva, competencias, competenciaId]);

  const compSel = competencias?.find((c) => c.id === competenciaId);
  const compFechada = compSel?.status === "encerrada" || compSel?.status === "arquivada";

  // Unidades visíveis
  const isGestor = !!me?.is_master || !!me?.acesso_todas_unidades;
  const { data: unidades } = useQuery({
    queryKey: ["unidades-contratados", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const q = supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      const { data } = await q;
      return data ?? [];
    },
  });

  // Se Diretor/Administrativo, força a unidade vinculada
  const { data: minhasUnidades } = useQuery({
    queryKey: ["minhas-unidades", me?.id],
    enabled: !!me && !isGestor,
    queryFn: async () => {
      const { data } = await supabase
        .from("usuario_unidades")
        .select("unidade_id, unidades(id, nome, sigla)")
        .eq("usuario_id", me!.id)
        .is("deleted_at", null);
      return (data ?? []).map((r: any) => r.unidades).filter(Boolean);
    },
  });

  useEffect(() => {
    if (unidadeId) return;
    if (!isGestor && minhasUnidades?.length) setUnidadeId(minhasUnidades[0].id);
    else if (isGestor && unidades?.length) setUnidadeId(unidades[0].id);
  }, [isGestor, unidades, minhasUnidades, unidadeId]);

  const unidadesVisiveis = isGestor ? (unidades ?? []) : (minhasUnidades ?? []);
  const unidadeSel = (unidadesVisiveis as any[]).find((u) => u.id === unidadeId);

  // Folha
  const carregar = useServerFn(listarFolhaContratados);
  const { data: folha, isFetching } = useQuery({
    queryKey: ["folha-contratados", competenciaId, unidadeId],
    enabled: !!competenciaId && !!unidadeId,
    queryFn: () => carregar({ data: { competencia_id: competenciaId, unidade_id: unidadeId } }),
  });

  // Estado local editável
  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({});
  useEffect(() => {
    if (!folha) return;
    const next: Record<string, LinhaState> = {};
    for (const item of folha) {
      const l = item.linha;
      next[item.profissional.id] = {
        profissional_id: item.profissional.id,
        status: (l?.status as StatusFreq) ?? "rascunho",
        dias_falta: Number(l?.dias_falta ?? 0),
        atestado: Number(l?.atestado ?? 0),
        he_50: Number(l?.he_50 ?? 0),
        he_100: Number(l?.he_100 ?? 0),
        adn: Number(l?.adn ?? 0),
        plantoes: Number(l?.plantoes ?? 0),
        sobreaviso: Number(l?.sobreaviso ?? 0),
        incentivo: Number(l?.incentivo ?? 0),
        observacoes: l?.observacoes ?? "",
      };
    }
    setLinhas(next);
  }, [folha]);

  const canEdit =
    !compFechada &&
    has("frequencia.editar");

  function readonlyLinha(l: LinhaState | undefined) {
    if (!l) return true;
    if (!canEdit) return true;
    // Após enviada/aprovada/em análise, campos ficam somente leitura
    return !(l.status === "rascunho" || l.status === "rejeitada");
  }

  function updateCampo(pid: string, campo: keyof LinhaState, valor: number | string) {
    setLinhas((prev) => {
      const cur = prev[pid];
      if (!cur) return prev;
      let v: any = valor;
      if (CAMPOS_NUM.includes(campo as any)) {
        const n = typeof valor === "number" ? valor : Number(valor);
        v = isNaN(n) || n < 0 ? 0 : n;
      }
      return { ...prev, [pid]: { ...cur, [campo]: v, _dirty: true } };
    });
  }

  const salvarFn = useServerFn(salvarFolhaContratados);
  const enviarFn = useServerFn(enviarFolhaContratados);

  const mSalvar = useMutation({
    mutationFn: async () => {
      const dirtyList = Object.values(linhas).filter((l) => l._dirty);
      if (!dirtyList.length) return { ok: true, sem_alteracoes: true };
      return salvarFn({
        data: {
          competencia_id: competenciaId,
          unidade_id: unidadeId,
          linhas: dirtyList.map((l) => ({
            profissional_id: l.profissional_id,
            dias_falta: l.dias_falta,
            atestado: l.atestado,
            he_50: l.he_50,
            he_100: l.he_100,
            adn: l.adn,
            plantoes: l.plantoes,
            sobreaviso: l.sobreaviso,
            incentivo: l.incentivo,
            observacoes: l.observacoes || null,
          })),
        },
      });
    },
    onSuccess: (r: any) => {
      if (r?.sem_alteracoes) toast.info("Nenhuma alteração para salvar.");
      else toast.success("Rascunho salvo.");
      qc.invalidateQueries({ queryKey: ["folha-contratados", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const mEnviar = useMutation({
    mutationFn: async () => {
      // salva antes se houver alterações
      const dirtyList = Object.values(linhas).filter((l) => l._dirty);
      if (dirtyList.length) {
        await salvarFn({
          data: {
            competencia_id: competenciaId,
            unidade_id: unidadeId,
            linhas: dirtyList.map((l) => ({
              profissional_id: l.profissional_id,
              dias_falta: l.dias_falta, atestado: l.atestado,
              he_50: l.he_50, he_100: l.he_100, adn: l.adn,
              plantoes: l.plantoes, sobreaviso: l.sobreaviso,
              incentivo: l.incentivo,
              observacoes: l.observacoes || null,
            })),
          },
        });
      }
      return enviarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId } });
    },
    onSuccess: (r: any) => {
      toast.success(`Enviado para aprovação (${r?.enviadas ?? 0} linhas).`);
      qc.invalidateQueries({ queryKey: ["folha-contratados", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  // Exportação PDF / Excel — só liberadas quando toda a folha estiver aprovada.
  const folhaAprovada = useMemo(() => {
    if (!folha?.length) return false;
    return folha.every((it: any) => it.linha?.status === "aprovada");
  }, [folha]);

  function mapExportItens(): ItemContratado[] {
    return (folha ?? []).map((it: any) => ({
      profissional: {
        matricula: it.profissional.matricula,
        nome: it.profissional.nome,
        cpf: it.profissional.cpf ?? null,
        cargo: it.profissional.cargo,
        setor: it.profissional.setor,
        banco: it.profissional.banco,
        agencia: it.profissional.agencia,
        conta_corrente: it.profissional.conta_corrente,
      },
      linha: it.linha,
    }));
  }

  async function handleExportarExcel() {
    if (!compSel) return;
    try {
      await gerarExcelFolhaContratados({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar Excel.");
    }
  }

  async function handleExportarPdf() {
    if (!compSel) return;
    try {
      await gerarFolhaContratadosOficial({
        competencia: { mes: compSel.mes as number, ano: compSel.ano as number },
        unidadeNome: unidadeSel ? `${unidadeSel.sigla ? unidadeSel.sigla + " — " : ""}${unidadeSel.nome}` : "",
        itens: mapExportItens(),
        emitidoPor: me?.nome_completo ?? me?.email ?? "—",
        unidadeId: unidadeSel?.id ?? null,
        secretariaId: me?.secretaria_id ?? null,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF.");
    }
  }

  const filtradas = useMemo(() => {
    if (!folha) return [];
    const q = busca.trim().toLowerCase();
    return folha.filter((it: any) => {
      const p = it.profissional;
      if (cargoFilter !== "todos" && p.cargo_id !== cargoFilter) return false;
      if (funcaoFilter !== "todos" && p.funcao_id !== funcaoFilter) return false;
      if (setorFilter !== "todos" && p.setor_id !== setorFilter) return false;
      if (pendFilter !== "todos") {
        const semConta = !p.banco || !p.agencia || !p.conta_corrente;
        if (pendFilter === "sem_conta"     && !semConta)      return false;
        if (pendFilter === "sem_cargo"     && p.cargo)        return false;
        if (pendFilter === "sem_lotacao"   && p.setor)        return false;
        if (pendFilter === "sem_matricula" && p.matricula)    return false;
        if (pendFilter === "sem_cpf"       && p.cpf)          return false;
      }
      if (!q) return true;
      return p.nome.toLowerCase().includes(q)
        || (p.matricula ?? "").toLowerCase().includes(q)
        || (p.cpf ?? "").toLowerCase().includes(q)
        || (p.cargo ?? "").toLowerCase().includes(q);
    });
  }, [folha, busca, cargoFilter, funcaoFilter, setorFilter, pendFilter]);

  const idsPagina = useMemo(
    () => filtradas.map((it: any) => it.profissional.id as string),
    [filtradas],
  );
  const { data: confMap } = useConferenciaProfissionais(idsPagina);

  const linhasConferencia = useMemo(
    () =>
      filtradas.map((it: any) => {
        const base: ProfConferencia = {
          id: it.profissional.id,
          nome: it.profissional.nome,
          matricula: it.profissional.matricula ?? null,
          cpf: it.profissional.cpf ?? null,
          cargo: it.profissional.cargo ?? null,
          setor: it.profissional.setor ?? null,
          banco: it.profissional.banco ?? null,
          agencia: it.profissional.agencia ?? null,
          conta_corrente: it.profissional.conta_corrente ?? null,
          cargo_id: it.profissional.cargo_id ?? null,
          funcao_id: it.profissional.funcao_id ?? null,
          setor_id: it.profissional.setor_id ?? null,
          vinculo: "Contratado",
        };
        return { it, conf: mergeConferencia(base, confMap) };
      }),
    [filtradas, confMap],
  );

  const linhasFinais = useMemo(
    () =>
      situacaoFilter === "todas"
        ? linhasConferencia
        : linhasConferencia.filter((x) => derivarSituacao(x.conf) === situacaoFilter),
    [linhasConferencia, situacaoFilter],
  );

  const rowsConf = useMemo(() => linhasConferencia.map((x) => x.conf), [linhasConferencia]);

  function openDossie(p: ProfConferencia) {
    setDossieProf(p);
    setDossieOpen(true);
  }

  if (!has("frequencia.visualizar")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para visualizar frequências.</p>
      </div>
    );
  }

  /* ------- ERP grid derivados de UI ------- */
  const FROZEN: FrozenCol[] = [
    { key: "num",       label: "Nº",           width: 48  },
    { key: "matricula", label: "Matrícula",    width: 96  },
    { key: "nome",      label: "Profissional", width: 240 },
  ];
  const L = frozenLeftMap(FROZEN);
  const colKeysAll = useMemo(() => [...CAMPOS_NUM] as string[], []);
  const rowIdsAll = useMemo(
    () => linhasFinais.map((x: any) => x.it.profissional.id as string),
    [linhasFinais],
  );
  // 3 frozen (Nº/Matrícula/Nome) + CPF + Cargo + Lotação + Dias
  // + CAMPOS_NUM (8) + Conta + Observações + Status
  const colCount = 3 + 4 + CAMPOS_NUM.length + 3;

  // Quantidade de dias da competência (para calcular "Dias trabalhados").
  const diasMes = useMemo(() => {
    if (!compSel?.ano || !compSel?.mes) return 30;
    return new Date(compSel.ano as number, compSel.mes as number, 0).getDate();
  }, [compSel]);

  const totCampo = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const k of colKeysAll) acc[k] = 0;
    for (const { it } of linhasFinais) {
      const l = linhas[it.profissional.id]; if (!l) continue;
      for (const k of colKeysAll) {
        const v = Number((l as any)[k] ?? 0);
        if (Number.isFinite(v)) acc[k] += v;
      }
    }
    return acc;
  }, [linhasFinais, linhas, colKeysAll]);

  const kpi = useMemo(() => {
    const sit = contarSituacoes(rowsConf);
    return {
      total: rowsConf.length,
      ativos: sit.ativos,
      ferias: sit.ferias,
      licenca: sit.licenca,
      afastados: sit.afastados,
      pendencias: sit.pendencias,
      naoElegiveis: sit.nao_elegiveis ?? 0,
      totalHE50: totCampo.he_50 ?? 0,
      totalHE100: totCampo.he_100 ?? 0,
      totalPlantoes: totCampo.plantoes ?? 0,
      totalFaltas: totCampo.dias_falta ?? 0,
    };
  }, [rowsConf, totCampo]);

  const handlePaste = useCallback(
    (rowId: string, colKey: string, matrix: string[][]) => {
      const rStart = rowIdsAll.indexOf(rowId);
      const cStart = colKeysAll.indexOf(colKey);
      if (rStart < 0 || cStart < 0) return;
      setLinhas((prev) => {
        const next = { ...prev };
        let touched = 0;
        matrix.forEach((row, dr) => {
          row.forEach((cell, dc) => {
            const rId = rowIdsAll[rStart + dr];
            const cKey = colKeysAll[cStart + dc];
            if (!rId || !cKey) return;
            const cur = next[rId]; if (!cur) return;
            const raw = String(cell ?? "").trim().replace(/\./g, "").replace(",", ".");
            const n = Number(raw.replace(/[^\d.-]/g, ""));
            if (!Number.isFinite(n)) return;
            next[rId] = { ...cur, [cKey]: n, _dirty: true };
            touched++;
          });
        });
        if (touched) toast.success(`${touched} valor(es) colado(s).`);
        return next;
      });
    },
    [rowIdsAll, colKeysAll],
  );

  const validateFalta   = (v: number) => (v > 31 ? "Faltas acima de 31 dias" : null);
  const validateHoras   = (v: number) => (v > 400 ? "Valor incomum (> 400h)" : null);
  const validateGeneric = (v: number) => (v < 0 ? "Valor negativo" : null);

  function focarLinha(rowId: string) {
    const tr = document.querySelector<HTMLTableRowElement>(
      `.erp-grid tr[data-row-id="${rowId.replace(/"/g, "")}"]`,
    );
    tr?.scrollIntoView({ block: "center", behavior: "smooth" });
    tr?.querySelector<HTMLInputElement>(".erp-cell-input")?.focus();
  }

  /** Ícone antes do nome conforme situação funcional. */
  function IconeSituacao({ situ }: { situ: string }) {
    const cls = "h-3.5 w-3.5 shrink-0";
    if (situ === "ferias")    return <Palmtree     className={cn(cls, "text-info")} />;
    if (situ === "licenca")   return <HeartPulse   className={cn(cls, "text-warning-soft-foreground")} />;
    if (situ === "afastado")  return <AlertOctagon className={cn(cls, "text-destructive")} />;
    if (situ === "cedido")    return <ArrowRightLeft className={cn(cls, "text-warning-soft-foreground")} />;
    if (situ === "desligado" || situ === "inativo")
      return <Ban className={cn(cls, "text-muted-foreground")} />;
    return null;
  }

  const PEND_OPTS: Array<{ id: typeof pendFilter; label: string }> = [
    { id: "todos",         label: "Sem pendências" },
    { id: "sem_conta",     label: "Sem conta bancária" },
    { id: "sem_cargo",     label: "Sem cargo" },
    { id: "sem_lotacao",   label: "Sem lotação" },
    { id: "sem_matricula", label: "Sem matrícula" },
    { id: "sem_cpf",       label: "Sem CPF" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Frequência — Contratados</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Folha de contratados no formato HMO — uma linha por profissional, com dados bancários para conferência da folha de pagamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => mSalvar.mutate()}
            disabled={!canEdit || mSalvar.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" /> Salvar rascunho
          </Button>
          <Button
            onClick={() => mEnviar.mutate()}
            disabled={!canEdit || !has("frequencia.enviar") || mEnviar.isPending || !folha?.length}
          >
            <Send className="mr-1.5 h-4 w-4" /> Enviar para aprovação
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="secondary"
                    onClick={handleExportarPdf}
                    disabled={!folhaAprovada}
                  >
                    <FileDown className="mr-1.5 h-4 w-4" /> PDF Oficial
                  </Button>
                </span>
              </TooltipTrigger>
              {!folhaAprovada && (
                <TooltipContent>Disponível somente após aprovação</TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    onClick={handleExportarExcel}
                    disabled={!folhaAprovada}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Exportar Excel
                  </Button>
                </span>
              </TooltipTrigger>
              {!folhaAprovada && (
                <TooltipContent>Disponível somente após aprovação</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Competência</label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MESES[(c.mes ?? 1) - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Unidade</label>
          {isGestor ? (
            <Select value={unidadeId} onValueChange={setUnidadeId}>
              <SelectTrigger><SelectValue placeholder="Selecionar unidade" /></SelectTrigger>
              <SelectContent>
                {unidadesVisiveis.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.sigla ? `${u.sigla} — ` : ""}{u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted/40 text-sm">
              {unidadesVisiveis[0]
                ? `${unidadesVisiveis[0].sigla ? unidadesVisiveis[0].sigla + " — " : ""}${unidadesVisiveis[0].nome}`
                : "Nenhuma unidade vinculada"}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, matrícula ou cargo" className="pl-8" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cargo</label>
          <Select value={cargoFilter} onValueChange={setCargoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosOpts?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Função</label>
          <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {funcoesOpts?.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Setor</label>
          <Select value={setorFilter} onValueChange={setSetorFilter} disabled={!unidadeId}>
            <SelectTrigger><SelectValue placeholder={unidadeId ? "Todos" : "Selecione uma unidade"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {setoresOpts?.map((s: any) => (
                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {compFechada && (
        <div className="rounded-md border border-warning/40 bg-warning-soft text-warning-soft-foreground text-sm px-3 py-2">
          Competência encerrada — folha em modo somente leitura.
        </div>
      )}

      <KpiFolhaBar k={kpi} />
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SituacaoResumo rows={rowsConf} />
          <InconsistenciasPanel rows={rowsConf} onGoto={focarLinha} />
        </div>
        <SituacaoFilter value={situacaoFilter} onChange={setSituacaoFilter} />
      </div>

      <div className="erp-grid">
        <ErpGridProvider rowIds={rowIdsAll} colKeys={colKeysAll} onPaste={handlePaste}>
          <table>
            <thead>
              <tr>
                <th className="erp-sticky" style={{ left: L.matricula, textAlign: "left" }}>Matrícula</th>
                <th className="erp-sticky" style={{ left: L.nome, textAlign: "left" }}>Profissional</th>
                <th className="erp-sticky erp-sticky-last" style={{ left: L.situacao, textAlign: "left" }}>Situação</th>
                <th className="erp-group-prof" style={{ textAlign: "left" }}>Cargo</th>
                <th className="erp-group-bank" style={{ textAlign: "left" }}>Banco</th>
                <th className="erp-group-bank" style={{ textAlign: "left" }}>AG</th>
                <th className="erp-group-bank" style={{ textAlign: "left" }}>CC</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>Faltas</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>ATT</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>HE 50%</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>HE 100%</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>ADN</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>Plantões</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>Sobreaviso</th>
                <th className="erp-group-lanc" style={{ textAlign: "right" }}>Incentivo</th>
                <th className="erp-group-obs" style={{ textAlign: "left", minWidth: 200 }}>Observações</th>
                <th style={{ textAlign: "center" }}>Status</th>
              </tr>
            </thead>
            <ErpTbody>
              {isFetching && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
              )}
              {!isFetching && linhasFinais.length === 0 && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum profissional contratado nesta unidade.
                </td></tr>
              )}
              {linhasFinais.map(({ it, conf }) => {
                const p = it.profissional;
                const l = linhas[p.id];
                if (!l) return null;
                const ro = readonlyLinha(l);
                const situ = derivarSituacao(conf);
                return (
                  <tr key={p.id} data-row-id={p.id} data-situacao={situ}>
                    <td className="erp-sticky" style={{ left: L.matricula, fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
                      {p.matricula ?? "—"}
                    </td>
                    <td className="erp-sticky" style={{ left: L.nome }}>
                      <ProfissionalNomeCell prof={conf} onOpenDossie={openDossie} secondary={p.cpf} />
                    </td>
                    <td className="erp-sticky erp-sticky-last" style={{ left: L.situacao }}>
                      <SituacaoBadge prof={conf} />
                    </td>
                    <td className="erp-group-prof text-muted-foreground">{p.cargo ?? "-"}</td>
                    <td className="erp-group-bank text-muted-foreground">{p.banco ?? "—"}</td>
                    <td className="erp-group-bank text-muted-foreground font-mono">{p.agencia ?? "—"}</td>
                    <td className="erp-group-bank text-muted-foreground font-mono">{p.conta_corrente ?? "—"}</td>
                    {CAMPOS_NUM.map((c) => {
                      const isFalta = c === "dias_falta";
                      const isHora  = c === "he_50" || c === "he_100" || c === "adn";
                      const isInc   = c === "incentivo";
                      return (
                        <td key={c} className="erp-group-lanc">
                          <NumberCell
                            rowId={p.id} colKey={c}
                            value={Number((l as any)[c] ?? 0)}
                            disabled={ro}
                            decimals={isInc ? 2 : 0}
                            validate={isFalta ? validateFalta : isHora ? validateHoras : validateGeneric}
                            onChange={(v) => updateCampo(p.id, c, v)}
                          />
                        </td>
                      );
                    })}
                    <td className="erp-group-obs">
                      <TextCell
                        rowId={p.id}
                        value={l.observacoes ?? ""}
                        disabled={ro}
                        onChange={(v) => updateCampo(p.id, "observacoes", v)}
                        placeholder="—"
                      />
                    </td>
                    <td className="text-center">
                      <StatusBadge domain="frequencia" value={l.status ?? "rascunho"} />
                    </td>
                  </tr>
                );
              })}
            </ErpTbody>
            <tfoot>
              <tr>
                <td className="erp-sticky" style={{ left: L.matricula }}></td>
                <td className="erp-sticky" style={{ left: L.nome }}>Totais</td>
                <td className="erp-sticky erp-sticky-last" style={{ left: L.situacao }}></td>
                <td colSpan={4}></td>
                {CAMPOS_NUM.map((c) => (
                  <td key={c} className="erp-group-lanc" style={{ textAlign: "right" }}>
                    {c === "incentivo"
                      ? (totCampo[c] ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : (totCampo[c] ?? 0).toLocaleString("pt-BR")}
                  </td>
                ))}
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </ErpGridProvider>
      </div>

      <p className="text-xs text-muted-foreground">
        Os campos <strong>Banco</strong>, <strong>Agência</strong> e <strong>Conta Corrente</strong> são somente leitura aqui —
        são atualizados no cadastro do profissional.
      </p>

      <DossieDrawer prof={dossieProf} open={dossieOpen} onOpenChange={setDossieOpen} />
    </div>
  );
}
