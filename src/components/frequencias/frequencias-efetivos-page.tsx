import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarFolhaEfetivos,
  salvarFolhaEfetivos,
  enviarFolhaEfetivos,
} from "@/lib/frequencias-efetivos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Send, Search, FileSpreadsheet, FileDown } from "lucide-react";
import { gerarFolhaEfetivosOficial, type UnidadeFolha } from "@/lib/pdf-folha-efetivos-oficial";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import type { Database } from "@/integrations/supabase/types";
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
import {
  FolhaBreadcrumb, ResumoDiasFaltasAtt, useSelectedErpRow,
} from "@/components/frequencias/resumo-dias-faltas-att";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

type LinhaState = {
  profissional_id: string;
  dias_trabalhados: number;
  faltas_injustificadas: number;
  atestado: number;
  he_50: number;
  he_100: number;
  ferias_terco: number;
  ferias_integral: number;
  sal_sub_h: number;
  adicional_noturno: number;
  aulas_suplementares: number;
  sobreaviso: number;
  plantoes_extras: number;
  incentivo: number;
  ferias: number;
  licenca_premio: number;
  observacoes: string;
  _dirty?: boolean;
};

const CAMPOS_OFICIAIS = [
  { key: "dias_trabalhados", label: "Dias" },
  { key: "faltas_injustificadas", label: "Dias Falta" },
  { key: "atestado", label: "ATT" },
  { key: "he_50", label: "HE 50%" },
  { key: "he_100", label: "HE 100%" },
  { key: "ferias_terco", label: "Férias 1/3" },
  { key: "ferias_integral", label: "Férias Integral" },
  { key: "sal_sub_h", label: "Sal./Sub.H" },
  { key: "adicional_noturno", label: "Adic. Not" },
  { key: "aulas_suplementares", label: "Aulas Suple." },
  { key: "sobreaviso", label: "Sobreaviso" },
  { key: "plantoes_extras", label: "Plantão" },
  { key: "incentivo", label: "Incentivo" },
] as const;

const CAMPOS_SMS = [
  { key: "ferias", label: "Férias (ind.)" },
  { key: "licenca_premio", label: "Lic-Prêmio" },
] as const;

const CAMPOS_NUM = [
  ...CAMPOS_OFICIAIS.map((c) => c.key),
  ...CAMPOS_SMS.map((c) => c.key),
] as const;

export function FrequenciasEfetivosPage() {
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

  // reset setor filter when unidade changes
  useEffect(() => { setSetorFilter("todos"); }, [unidadeId]);

  const { data: competencias } = useQuery({
    queryKey: ["comps-efetivos"],
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

  const isGestor = !!me?.is_master || !!me?.acesso_todas_unidades;
  const { data: unidades } = useQuery({
    queryKey: ["unidades-efetivos", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      return data ?? [];
    },
  });

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

  const carregar = useServerFn(listarFolhaEfetivos);
  const { data: folha, isFetching } = useQuery({
    queryKey: ["folha-efetivos", competenciaId, unidadeId],
    enabled: !!competenciaId && !!unidadeId && has("frequencia.visualizar"),
    queryFn: () => carregar({ data: { competencia_id: competenciaId, unidade_id: unidadeId } }),
  });

  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({});
  useEffect(() => {
    if (!folha?.itens) return;
    const next: Record<string, LinhaState> = {};
    for (const item of folha.itens) {
      const l = item.linha as any;
      next[item.profissional.id] = {
        profissional_id: item.profissional.id,
        dias_trabalhados: Number(l?.dias_trabalhados ?? 0),
        faltas_injustificadas: Number(l?.faltas_injustificadas ?? 0),
        atestado: Number(l?.atestado ?? 0),
        he_50: Number(l?.he_50 ?? 0),
        he_100: Number(l?.he_100 ?? 0),
        ferias_terco: Number(l?.ferias_terco ?? 0),
        ferias_integral: Number(l?.ferias_integral ?? 0),
        sal_sub_h: Number(l?.sal_sub_h ?? 0),
        adicional_noturno: Number(l?.adicional_noturno ?? 0),
        aulas_suplementares: Number(l?.aulas_suplementares ?? 0),
        sobreaviso: Number(l?.sobreaviso ?? 0),
        plantoes_extras: Number(l?.plantoes_extras ?? 0),
        incentivo: Number(l?.incentivo ?? 0),
        ferias: Number(l?.ferias ?? 0),
        licenca_premio: Number(l?.licenca_premio ?? 0),
        observacoes: l?.observacoes ?? "",
      };
    }
    setLinhas(next);
  }, [folha]);

  const folhaStatus = (folha?.frequencia_status as StatusFreq) ?? "rascunho";
  const folhaEditavel =
    folhaStatus === "rascunho" ||
    folhaStatus === "com_pendencias" ||
    folhaStatus === "rejeitada";
  const canEdit = !compFechada && has("frequencia.editar") && folhaEditavel;

  function updateCampo(pid: string, campo: keyof LinhaState, valor: number | string) {
    setLinhas((prev) => {
      const cur = prev[pid];
      if (!cur) return prev;
      let v: any = valor;
      if ((CAMPOS_NUM as readonly string[]).includes(campo as string)) {
        const n = typeof valor === "number" ? valor : Number(valor);
        v = isNaN(n) || n < 0 ? 0 : n;
      }
      return { ...prev, [pid]: { ...cur, [campo]: v, _dirty: true } };
    });
  }

  const salvarFn = useServerFn(salvarFolhaEfetivos);
  const enviarFn = useServerFn(enviarFolhaEfetivos);

  function payloadDirty() {
    return Object.values(linhas)
      .filter((l) => l._dirty)
      .map((l) => ({
        profissional_id: l.profissional_id,
        dias_trabalhados: l.dias_trabalhados,
        faltas_injustificadas: l.faltas_injustificadas,
        atestado: l.atestado,
        he_50: l.he_50,
        he_100: l.he_100,
        ferias_terco: l.ferias_terco,
        ferias_integral: l.ferias_integral,
        sal_sub_h: l.sal_sub_h,
        adicional_noturno: l.adicional_noturno,
        aulas_suplementares: l.aulas_suplementares,
        sobreaviso: l.sobreaviso,
        plantoes_extras: l.plantoes_extras,
        incentivo: l.incentivo,
        ferias: l.ferias,
        licenca_premio: l.licenca_premio,
        observacoes: l.observacoes || null,
      }));
  }

  const mSalvar = useMutation({
    mutationFn: async () => {
      const list = payloadDirty();
      if (!list.length) return { ok: true, sem_alteracoes: true };
      return salvarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId, linhas: list } });
    },
    onSuccess: (r: any) => {
      if (r?.sem_alteracoes) toast.info("Nenhuma alteração para salvar.");
      else toast.success("Rascunho salvo.");
      qc.invalidateQueries({ queryKey: ["folha-efetivos", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const mEnviar = useMutation({
    mutationFn: async () => {
      const list = payloadDirty();
      if (list.length) {
        await salvarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId, linhas: list } });
      }
      return enviarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId } });
    },
    onSuccess: (r: any) => {
      toast.success(`Enviado para aprovação (${r?.enviadas ?? 0} linhas).`);
      qc.invalidateQueries({ queryKey: ["folha-efetivos", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao enviar."),
  });

  const filtradas = useMemo(() => {
    const list = folha?.itens ?? [];
    const q = busca.trim().toLowerCase();
    return list.filter((it: any) => {
      const p = it.profissional;
      if (cargoFilter !== "todos" && p.cargo_id !== cargoFilter) return false;
      if (funcaoFilter !== "todos" && p.funcao_id !== funcaoFilter) return false;
      if (setorFilter !== "todos" && p.setor_id !== setorFilter) return false;
      if (!q) return true;
      return p.nome.toLowerCase().includes(q)
        || (p.matricula ?? "").toLowerCase().includes(q)
        || (p.cargo ?? "").toLowerCase().includes(q);
    });
  }, [folha, busca, cargoFilter, funcaoFilter, setorFilter]);

  // Enriquecimento gerencial (UI-only): usa dados já cadastrados nos
  // profissionais para derivar situação, alertas e elegibilidade.
  const idsPagina = useMemo(
    () => filtradas.map((it: any) => it.profissional.id as string),
    [filtradas],
  );
  const { data: confMap } = useConferenciaProfissionais(idsPagina);

  const linhasConferencia: Array<{ it: any; conf: ProfConferencia }> = useMemo(() => {
    return filtradas.map((it: any) => {
      const base: ProfConferencia = {
        id: it.profissional.id,
        nome: it.profissional.nome,
        matricula: it.profissional.matricula ?? null,
        cargo: it.profissional.cargo ?? null,
        funcao: it.profissional.funcao ?? null,
        setor: it.profissional.setor ?? null,
        cargo_id: it.profissional.cargo_id ?? null,
        funcao_id: it.profissional.funcao_id ?? null,
        setor_id: it.profissional.setor_id ?? null,
        vinculo: "Efetivo",
      };
      return { it, conf: mergeConferencia(base, confMap) };
    });
  }, [filtradas, confMap]);

  const linhasFinais = useMemo(
    () =>
      situacaoFilter === "todas"
        ? linhasConferencia
        : linhasConferencia.filter((x) => derivarSituacao(x.conf) === situacaoFilter),
    [linhasConferencia, situacaoFilter],
  );

  const rowsConf = useMemo(() => linhasConferencia.map((x) => x.conf), [linhasConferencia]);

  if (!has("frequencia.visualizar")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para visualizar frequências.</p>
      </div>
    );
  }

  function openDossie(p: ProfConferencia) {
    setDossieProf(p);
    setDossieOpen(true);
  }

  /* ------- ERP grid: derivados de UI (sem impacto em back-end) ------- */
  const FROZEN: FrozenCol[] = [
    { key: "matricula", label: "Matrícula",    width: 100 },
    { key: "nome",      label: "Profissional", width: 260 },
    { key: "situacao",  label: "Situação",     width: 130 },
  ];
  const L = frozenLeftMap(FROZEN);

  const colKeysAll = useMemo(
    () => [...CAMPOS_OFICIAIS.map((c) => c.key), ...CAMPOS_SMS.map((c) => c.key)],
    [],
  ) as string[];
  const rowIdsAll = useMemo(
    () => linhasFinais.map((x: any) => x.it.profissional.id as string),
    [linhasFinais],
  );
  const colCount = 3 + 4 + CAMPOS_OFICIAIS.length + CAMPOS_SMS.length + 2;

  /* Totais por campo (rodapé) e agregados p/ KPIs (topo) */
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
      totalPlantoes: totCampo.plantoes_extras ?? 0,
      totalFaltas: totCampo.faltas_injustificadas ?? 0,
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

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FolhaBreadcrumb current="Folha Pagamento — Efetivos" />
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Folha — Efetivos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Folha oficial de servidores estatutários (efetivos), com campos adicionais da SMS ao lado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge domain="frequencia" value={folhaStatus} />
          <Button
            variant="outline"
            onClick={() => mSalvar.mutate()}
            disabled={!canEdit || mSalvar.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" /> Salvar rascunho
          </Button>
          <Button
            onClick={() => mEnviar.mutate()}
            disabled={!canEdit || !has("frequencia.enviar") || mEnviar.isPending || !folha?.itens?.length}
          >
            <Send className="mr-1.5 h-4 w-4" /> Enviar para aprovação
          </Button>
          <Button
            variant="secondary"
            disabled={folhaStatus !== "aprovada" || !folha?.itens?.length}
            title={folhaStatus !== "aprovada" ? "Disponível somente após aprovação" : "Gerar PDF no padrão oficial"}
            onClick={async () => {
              try {
                const unidadeNome = unidadesVisiveis.find((u: any) => u.id === unidadeId)?.nome ?? "UNIDADE";
                const grupos: Record<string, { codigo_setor: string; nome_setor: string; itens: any[] }> = {};
                let seq = 1;
                for (const it of folha!.itens as any[]) {
                  const setor = it.profissional.setor ?? "SEM SETOR";
                  if (!grupos[setor]) {
                    grupos[setor] = { codigo_setor: String(seq++), nome_setor: setor, itens: [] };
                  }
                  const l = it.linha ?? {};
                  grupos[setor].itens.push({
                    profissional: it.profissional,
                    totais: {
                      dias_falta: Number(l.faltas_injustificadas ?? 0),
                      atestado: Number(l.atestado ?? 0),
                      maternidade: 0,
                      he_50: Number(l.he_50 ?? 0),
                      he_100: Number(l.he_100 ?? 0),
                      ferias_terco: Number(l.ferias_terco ?? 0),
                      ferias_integral: Number(l.ferias_integral ?? 0),
                      sal_sub_h: Number(l.sal_sub_h ?? 0),
                      adicional_noturno: Number(l.adicional_noturno ?? 0),
                      aulas_suplementares: Number(l.aulas_suplementares ?? 0),
                      plantao: Number(l.plantoes_extras ?? 0),
                      sobreaviso: Number(l.sobreaviso ?? 0),
                      incentivo: Number(l.incentivo ?? 0),
                    },
                  });
                }
                const unidadesInput: UnidadeFolha[] = [
                  {
                    codigo_unidade: "1.18.XXX",
                    nome_unidade: unidadeNome,
                    grupos: Object.values(grupos),
                  },
                ];
                await gerarFolhaEfetivosOficial({
                  competencia: { mes: compSel?.mes ?? 1, ano: compSel?.ano ?? new Date().getFullYear() },
                  unidades: unidadesInput,
                  emitidoPor: me?.nome_completo ?? me?.email ?? "SISTEMA",
                  unidadeId: unidadeId ?? null,
                  secretariaId: me?.secretaria_id ?? null,
                });
              } catch (e: any) {
                toast.error(e?.message ?? "Falha ao gerar PDF.");
              }
            }}
          >
            <FileDown className="mr-1.5 h-4 w-4" /> PDF Oficial
          </Button>
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

      {/* Painel gerencial (UI-only) */}
      <KpiFolhaBar k={kpi} />
      <ResumoDiasFaltasAtt
        totais={{
          dias: totCampo.dias_trabalhados ?? 0,
          faltas: totCampo.faltas_injustificadas ?? 0,
          att: totCampo.atestado ?? 0,
        }}
        selecionado={(() => {
          if (!selectedRowId) return null;
          const l = linhas[selectedRowId];
          const p = rowsConf.find((r) => r.profissional_id === selectedRowId);
          if (!l || !p) return null;
          return {
            nome: p.nome_completo ?? "—",
            valores: {
              dias: Number(l.dias_trabalhados ?? 0),
              faltas: Number(l.faltas_injustificadas ?? 0),
              att: Number(l.atestado ?? 0),
            },
          };
        })()}
      />
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SituacaoResumo rows={rowsConf} />
          <InconsistenciasPanel rows={rowsConf} onGoto={focarLinha} />
        </div>
        <SituacaoFilter value={situacaoFilter} onChange={setSituacaoFilter} />
      </div>

      {/* Grade ERP — cabeçalho fixo, colunas congeladas, digitação rápida */}
      <div className="erp-grid">
        <ErpGridProvider rowIds={rowIdsAll} colKeys={colKeysAll} onPaste={handlePaste}>
          <table>
            <thead>
              <tr>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "left" }} rowSpan={2}>Matrícula</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "left" }} rowSpan={2}>Profissional</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "left" }} rowSpan={2}>Situação</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "right" }} rowSpan={2}>Proj</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "right" }} rowSpan={2}>H.P</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "right" }} rowSpan={2}>C.H</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700" style={{ textAlign: "right" }} rowSpan={2}>Jorn</th>
                <th className="bg-teal-900! text-teal-100! font-bold text-xs uppercase tracking-wider border-x border-teal-700" colSpan={CAMPOS_OFICIAIS.length} style={{ textAlign: "center" }}>Lançamentos — Modelo Oficial</th>
                <th className="bg-amber-900! text-amber-100! font-bold text-xs uppercase tracking-wider border-x border-amber-700" colSpan={CAMPOS_SMS.length} style={{ textAlign: "center" }}>Controles SMS</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-x border-slate-700" rowSpan={2} style={{ textAlign: "left", minWidth: 200 }}>Observações</th>
                <th className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider" rowSpan={2} style={{ textAlign: "center" }}>Status</th>
              </tr>
              <tr>
                {CAMPOS_OFICIAIS.map((c) => (
                  <th key={c.key} className="bg-teal-800! text-white! font-bold text-[11px] whitespace-nowrap border-r border-slate-700" style={{ textAlign: "right" }}>{c.label}</th>
                ))}
                {CAMPOS_SMS.map((c) => (
                  <th key={c.key} className="bg-amber-800! text-white! font-bold text-[11px] whitespace-nowrap border-r border-slate-700" style={{ textAlign: "right" }}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <ErpTbody>
              {isFetching && (
                <tr><td colSpan={colCount} className="bg-slate-50 text-slate-600 font-medium py-8 text-center text-sm">Carregando…</td></tr>
              )}
              {!isFetching && linhasFinais.length === 0 && (
                <tr><td colSpan={colCount} className="bg-slate-50 text-slate-600 font-medium py-8 text-center text-sm">
                  Nenhum servidor efetivo nesta unidade.
                </td></tr>
              )}
              {linhasFinais.map(({ it, conf }) => {
                const p = it.profissional;
                const l = linhas[p.id];
                if (!l) return null;
                const linhaAprovada = (it.linha as any)?.status_linha === "aprovada";
                const ro = !canEdit || linhaAprovada;
                const situ = derivarSituacao(conf);
                return (
                  <tr key={p.id} data-row-id={p.id} data-situacao={situ}>
                    <td style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11 }}>
                      {p.matricula ?? "—"}
                    </td>
                    <td>
                      <ProfissionalNomeCell prof={conf} onOpenDossie={openDossie} secondary={p.cargo} />
                    </td>
                    <td>
                      <SituacaoBadge prof={conf} />
                    </td>
                    <td className="text-right text-muted-foreground tabular-nums">{p.proj ?? "-"}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{p.h_p ?? "-"}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{p.c_h ?? "-"}</td>
                    <td className="text-right text-muted-foreground tabular-nums">{p.jorn ?? "-"}</td>
                    {CAMPOS_OFICIAIS.map((c) => {
                      const isFalta = c.key === "faltas_injustificadas";
                      const isHora  = c.key === "he_50" || c.key === "he_100" || c.key === "sal_sub_h" || c.key === "adicional_noturno";
                      const isInc   = c.key === "incentivo";
                      return (
                        <td key={c.key} className="erp-group-lanc">
                          <NumberCell
                            rowId={p.id} colKey={c.key}
                            value={Number((l as any)[c.key] ?? 0)}
                            disabled={ro}
                            decimals={isInc ? 2 : 0}
                            validate={isFalta ? validateFalta : isHora ? validateHoras : validateGeneric}
                            onChange={(v) => updateCampo(p.id, c.key as keyof LinhaState, v)}
                          />
                        </td>
                      );
                    })}
                    {CAMPOS_SMS.map((c) => (
                      <td key={c.key} className="erp-group-sms">
                        <NumberCell
                          rowId={p.id} colKey={c.key}
                          value={Number((l as any)[c.key] ?? 0)}
                          disabled={ro}
                          validate={validateGeneric}
                          onChange={(v) => updateCampo(p.id, c.key as keyof LinhaState, v)}
                        />
                      </td>
                    ))}
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
                      <Badge variant="outline">
                        {(it.linha as any)?.status_linha ?? "pendente"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </ErpTbody>
            <tfoot>
              <tr>
                <td></td>
                <td>Totais</td>
                <td></td>
                <td colSpan={4}></td>
                {CAMPOS_OFICIAIS.map((c) => (
                  <td key={c.key} className="erp-group-lanc" style={{ textAlign: "right" }}>
                    {c.key === "incentivo"
                      ? (totCampo[c.key] ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : (totCampo[c.key] ?? 0).toLocaleString("pt-BR")}
                  </td>
                ))}
                {CAMPOS_SMS.map((c) => (
                  <td key={c.key} className="erp-group-sms" style={{ textAlign: "right" }}>
                    {(totCampo[c.key] ?? 0).toLocaleString("pt-BR")}
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
        <strong>Proj</strong>, <strong>H.P</strong>, <strong>C.H</strong> e <strong>Jorn</strong> são somente leitura —
        vêm do cadastro do profissional. Os campos em amarelo (<em>Férias indicativo</em>, <em>Licença-Prêmio</em>)
        são controles internos da SMS e não fazem parte do modelo oficial da Prefeitura.
      </p>

      <DossieDrawer prof={dossieProf} open={dossieOpen} onOpenChange={setDossieOpen} />
    </div>
  );
}