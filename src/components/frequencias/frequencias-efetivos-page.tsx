import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { parseNumeroPtBr, valorCelula } from "@/lib/numero-ptbr";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarFolhaEfetivos,
  salvarFolhaEfetivos,
  enviarFolhaEfetivos,
} from "@/lib/frequencias-efetivos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared";
import { linhaEditavel, MSG_LINHA_BLOQUEADA } from "@/lib/edicao-linha";
import { statusLinhaClass, statusLinhaLabel } from "@/lib/status-linha";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast, Toaster } from "sonner";
import { Save, Send, Search, FileSpreadsheet, FileDown, AlertTriangle } from "lucide-react";
import type { UnidadeFolha } from "@/lib/pdf-folha-efetivos-oficial";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useUnitScope } from "@/hooks/use-unit-scope";

import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import { bloqueadoPorPrazo, MSG_PRAZO_ENCERRADO } from "@/lib/prazo-envio";
import type { Database } from "@/integrations/supabase/types";
import { useConferenciaProfissionais, mergeConferencia } from "@/hooks/use-conferencia";
import {
  SituacaoResumo,
  SituacaoFilter,
  ProfissionalNomeCell,
  SituacaoBadge,
  ProfissionalEdicaoModal,
  type EdicaoCampo,
  type SituacaoFilterValue,
} from "@/components/shared/gerencial";
import { UnidadeFilter } from "@/components/shared";

import { LinhaAnexos } from "@/components/frequencias/linha-anexos";
import { AutosaveBadge } from "@/components/frequencias/autosave-badge";
import { useAutosaveFolha } from "@/hooks/use-autosave-folha";
import { EnviarFolhaDialog } from "@/components/frequencias/enviar-folha-dialog";
import {
  contarSituacoes,
  derivarSituacao,
  overrideSituacaoFolha,
  aplicarOverrideSituacao,
  type ProfConferencia,
} from "@/lib/situacao-funcional";
import {
  ErpGridProvider,
  ErpTbody,
  NumberCell,
  TextCell,
  normalizarParaSoma,
  KpiFolhaBar,
  InconsistenciasPanel,
  frozenLeftMap,
  type FrozenCol,
} from "@/components/erp-grid";
import {
  FolhaBreadcrumb,
  ResumoDiasFaltasAtt,
  useSelectedErpRow,
} from "@/components/frequencias/resumo-dias-faltas-att";
import { MultiSelect } from "@/components/ui/multi-select";
import { useFrequencyRealtime } from "@/lib/realtime/frequency-realtime";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type LinhaState = {
  profissional_id: string;
  status_linha: StatusFreq;
  dias_trabalhados: number | string;
  faltas_injustificadas: number | string;
  atestado: number | string;
  he_50: number | string;
  he_100: number | string;
  ferias_terco: number | string;
  ferias_integral: number | string;
  sal_sub_h: number | string;
  adicional_noturno: number | string;
  aulas_suplementares: number | string;
  sobreaviso: number | string;
  plantoes_extras: number | string;
  incentivo: number | string;
  ferias: number | string;
  licenca_premio: number | string;
  observacoes: string;
  _dirty?: boolean;
};

/** Converte uma linha da grade no payload aceito pelo servidor. */
function mapLinhaPayloadEfetivos(l: LinhaState): any {
  return {
    profissional_id: l.profissional_id,
    status_linha: l.status_linha,
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
  };
}


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

const CAMPOS_NUM = [...CAMPOS_OFICIAIS.map((c) => c.key), ...CAMPOS_SMS.map((c) => c.key)] as const;

export function FrequenciasEfetivosPage() {
  const qc = useQueryClient();
  const [enviarAberto, setEnviarAberto] = useState(false);
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const { data: compAtiva } = useCompetenciaAtiva();
  const { isGlobal, unidadesPermitidas, unidadePadraoId } = useUnitScope();

  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");

  // Sincroniza unidadeId com a padrão do escopo
  useEffect(() => {
    if (!unidadeId && unidadePadraoId) {
      setUnidadeId(unidadePadraoId);
    }
  }, [unidadePadraoId, unidadeId]);

  const [busca, setBusca] = useState("");
  const [cargoFilter, setCargoFilter] = useState<string>("todos");
  const [funcaoFilter, setFuncaoFilter] = useState<string>("todos");
  const [setorFilter, setSetorFilter] = useState<string[]>([]);
  const [situacaoFilter, setSituacaoFilter] = useState<SituacaoFilterValue>("todas");
  const [dossieProf, setDossieProf] = useState<ProfConferencia | null>(null);
  const [dossieOpen, setDossieOpen] = useState(false);

  const { data: cargosOpts } = useQuery({
    queryKey: ["cargos-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cargos")
        .select("id, nome")
        .is("deleted_at", null)
        
        .order("nome");
      return data ?? [];
    },
  });
  const { data: funcoesOpts } = useQuery({
    queryKey: ["funcoes-filter"],
    queryFn: async () => {
      const { data } = await supabase
        .from("funcoes")
        .select("id, nome")
        .is("deleted_at", null)
        
        .order("nome");
      return data ?? [];
    },
  });
  const { data: setoresOpts } = useQuery({
    queryKey: ["setores-filter", unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("setores")
        .select("id, nome")
        .eq("unidade_id", unidadeId)
        .is("deleted_at", null)
        .order("nome");
      return data ?? [];
    },
  });

  // reset setor filter when unidade changes
  useEffect(() => {
    setSetorFilter([]);
  }, [unidadeId]);

  const { data: competencias } = useQuery({
    queryKey: ["comps-efetivos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("competencias")
        .select("id, ano, mes, status, prazo_envio")
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

  const isGestor = useMemo(() => 
    !!me?.is_master || !!me?.acesso_todas_unidades, 
    [me]
  );

  const { data: unidades } = useQuery({
    queryKey: ["unidades-efetivos-lista", me?.id],
    enabled: !!me,
    queryFn: async () => {
      const { data } = await supabase
        .from("unidades")
        .select("id, nome, sigla")
        .is("deleted_at", null)
        .order("nome");
      return data ?? [];
    },
  });

  const unidadesVisiveis = useMemo(() => {
    if (!me || !unidades) return [];
    if (isGlobal) return unidades;
    
    const permitidas = new Set(unidadesPermitidas || []);
    return unidades.filter(u => permitidas.has(u.id));
  }, [me, unidades, isGlobal, unidadesPermitidas]);

  useEffect(() => {
    // Se unidadeId está vazio, tenta a padrão do escopo
    if (!unidadeId && unidadePadraoId) {
      setUnidadeId(unidadePadraoId);
    } 
    // Se ainda vazio e temos unidades visíveis, pega a primeira
    else if (!unidadeId && unidadesVisiveis.length > 0) {
      setUnidadeId(unidadesVisiveis[0].id);
    }
  }, [unidadesVisiveis, unidadeId, unidadePadraoId]);


  const unidadeSel = useMemo(() => 
    unidadesVisiveis.find((u: any) => u.id === unidadeId),
    [unidadesVisiveis, unidadeId]
  );

  // Filtro de setor efetivo — precisa ser IDÊNTICO na leitura e na gravação,
  // senão salva numa folha (setor) diferente da que está sendo exibida.
  const setorParam = useMemo(
    () =>
      setorFilter.length > 0 && setorFilter.length !== (setoresOpts?.length ?? 0)
        ? setorFilter
        : undefined,
    [setorFilter, setoresOpts],
  );

  const carregar = useServerFn(listarFolhaEfetivos);
  const { data: folha, isFetching } = useQuery({
    queryKey: ["folha-efetivos", competenciaId, unidadeId, setorParam ?? "all"],
    enabled: !!competenciaId && !!unidadeId && has("frequencia.visualizar"),
    queryFn: () => carregar({ data: { competencia_id: competenciaId, unidade_id: unidadeId, setor_id: setorParam } }),
  });

  // Setor único (server aceita apenas um UUID ao gravar/enviar)
  const setorUnico = setorParam && setorParam.length === 1 ? setorParam[0] : undefined;

  useFrequencyRealtime({ 
    competenciaId, 
    unidadeId, 
    frequenciaId: folha?.frequencia_id 
  });

  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({});
  useEffect(() => {
    if (!folha?.itens) return;
    setLinhas((prev) => {
      const next: Record<string, LinhaState> = {};
      for (const item of folha.itens) {
        const l = item.linha as any;
        const anterior = prev[item.profissional.id];
        // Nunca sobrescreve valores digitados e ainda não salvos (refetch/realtime).
        if (anterior?._dirty) {
          next[item.profissional.id] = anterior;
          continue;
        }
        next[item.profissional.id] = {
          profissional_id: item.profissional.id,
          status_linha: (l?.status_linha as StatusFreq) ?? "pendente",
          dias_trabalhados: String(l?.dias_trabalhados ?? "0"),
          faltas_injustificadas: String(l?.faltas_injustificadas ?? "0"),
          atestado: String(l?.atestado ?? "0"),
          he_50: String(l?.he_50 ?? "0"),
          he_100: String(l?.he_100 ?? "0"),
          ferias_terco: String(l?.ferias_terco ?? "0"),
          ferias_integral: String(l?.ferias_integral ?? "0"),
          sal_sub_h: String(l?.sal_sub_h ?? "0"),
          adicional_noturno: String(l?.adicional_noturno ?? "0"),
          aulas_suplementares: String(l?.aulas_suplementares ?? "0"),
          sobreaviso: String(l?.sobreaviso ?? "0"),
          plantoes_extras: String(l?.plantoes_extras ?? "0"),
          incentivo: String(l?.incentivo ?? "0"),
          ferias: String(l?.ferias ?? "0"),
          licenca_premio: String(l?.licenca_premio ?? "0"),
          observacoes: l?.observacoes ?? "",
        };
      }
      return next;
    });
  }, [folha]);


  const folhaStatus = (folha?.frequencia_status as StatusFreq) ?? "rascunho";
  const folhaEditavel =
    folhaStatus === "rascunho" ||
    folhaStatus === "com_pendencias" ||
    folhaStatus === "rejeitada" ||
    folhaStatus === "devolvida";

  // Mapeamento de perfis para controle de botões na interface (EFETIVOS)
  const isMaster = !!me?.is_master;
  const perfilCodigo = me?.perfil_codigo || ""; // Usa o campo direto do UserContext
  const isGestorPerfil = perfilCodigo === "GESTOR" || isMaster;
  const isDiretor = perfilCodigo === "DIRETOR_UNIDADE" || isMaster;
  const isOperacional = perfilCodigo === "OPERACIONAL_ADM" || isMaster;

  // Master/Gestor mantêm a edição mesmo após o envio para análise (o backend
  // já permite esse bypass); os demais perfis só editam folha em aberto.
  const prazoBloqueado = bloqueadoPorPrazo({
    prazo: (compSel as any)?.prazo_envio,
    perfilCodigo,
    isMaster,
  });

  const canEdit =
    !prazoBloqueado &&
    !compFechada &&
    has("frequencia.editar") &&
    (folhaEditavel || isGestorPerfil) &&
    (isDiretor || isOperacional || isGestorPerfil);

<<<<<<< HEAD
  /**
   * Regra institucional: depois que a folha sai da unidade (enviada/em análise/
   * aprovada), o Diretor só volta a editar o profissional cuja LINHA foi
   * rejeitada ou devolvida para correção. Linha aprovada nunca é editável.
   */
  const linhaEditavel = (statusLinha: string | null | undefined) => {
    const s = statusLinha ?? "pendente";
    if (s === "aprovada") return false;
    if (folhaEditavel) return true;
    return s === "rejeitada" || s === "devolvida";
  };

  const canEnviar = !prazoBloqueado && (folhaStatus === "rascunho" || folhaStatus === "com_pendencias" || folhaStatus === "rejeitada" || folhaStatus === "devolvida" || ((folha?.itens ?? []) as any[]).some((it) => { const s = (it.linha as any)?.status_linha; return s === "rejeitada" || s === "devolvida"; })) && has("frequencia.enviar") && (isDiretor || isGestorPerfil);

=======
  const canEnviar = !prazoBloqueado && (folhaStatus === "rascunho" || folhaStatus === "com_pendencias" || folhaStatus === "rejeitada" || folhaStatus === "devolvida") && has("frequencia.enviar") && (isDiretor || isGestorPerfil);
>>>>>>> b93b0880a607d07bfb337efda6e47d0aa1e80c0a

  const salvarFn = useServerFn(salvarFolhaEfetivos);
  const enviarFn = useServerFn(enviarFolhaEfetivos);

  // ---------- Autosalvamento em segundo plano ----------
  const linhasRef = useRef<Record<string, LinhaState>>({});
  linhasRef.current = linhas;

  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;

  const autosaveRun = useCallback(async () => {
    if (!canEditRef.current || !competenciaId || !unidadeId) return false;
    const pendentes = Object.values(linhasRef.current).filter((l) => l._dirty);
    if (!pendentes.length) return false;

    const list = pendentes.map(mapLinhaPayloadEfetivos);
    const snapshot = new Map(list.map((p) => [p.profissional_id, JSON.stringify(p)]));

    const result = await salvarFn({
      data: { competencia_id: competenciaId, unidade_id: unidadeId, setor_id: setorUnico, linhas: list },
    });
    if (!result?.ok || result.processadas !== list.length) return false;

    // Limpa o "sujo" apenas das linhas cujo conteúdo não mudou durante o envio.
    setLinhas((prev) => {
      const next: Record<string, LinhaState> = { ...prev };
      for (const [pid, serial] of snapshot) {
        const atual = next[pid];
        if (!atual) continue;
        if (JSON.stringify(mapLinhaPayloadEfetivos(atual)) === serial) {
          next[pid] = { ...atual, _dirty: false };
        }
      }
      return next;
    });

    qc.invalidateQueries({ queryKey: ["frequencia-resumo", competenciaId, unidadeId] });
    return true;
  }, [competenciaId, unidadeId, setorUnico, salvarFn, qc]);

  const autosave = useAutosaveFolha({ enabled: canEdit, run: autosaveRun, delay: 900 });
  const autosaveRef = useRef(autosave);
  autosaveRef.current = autosave;

  // Grava o que estiver pendente ao sair da página / trocar de aba.
  useEffect(() => {
    const handler = () => {
      if (Object.values(linhasRef.current).some((l) => l._dirty)) autosaveRef.current.flush();
    };
    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      handler();
    };
  }, []);

  const updateCampo = useCallback((pid: string, campo: keyof LinhaState, valor: number | string) => {
    const cur = linhasRef.current[pid];
    if (!cur) return;
    const next = { ...linhasRef.current, [pid]: { ...cur, [campo]: valor, _dirty: true } };
    linhasRef.current = next;
    setLinhas(next);

    // Autosalve: campos numéricos já chegam aqui no onBlur (grava na hora);
    // texto livre usa debounce enquanto o usuário digita.
    if (campo === "observacoes") autosaveRef.current.schedule();
    else autosaveRef.current.flush();
  }, []);

  function payloadDirty(): any[] {
    return Object.values(linhas)
      .filter((l) => l._dirty)
      .map((l) => ({
        profissional_id: l.profissional_id,
        status_linha: l.status_linha,
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

  /** Itens para exportação: mescla o que está digitado na grade (mesmo não salvo). */
  function itensParaExport() {
    return ((folha?.itens ?? []) as any[]).map((it) => {
      const editada = (linhas as any)[it.profissional.id];
      const base = editada
        ? { ...(it.linha ?? {}), ...editada, status_linha: editada.status_linha ?? it.linha?.status_linha ?? "pendente" }
        : (it.linha ?? null);
      
      const conf = (confMap as any)?.get?.(it.profissional.id) || { ...it.profissional, vinculo: "Efetivo" };
      const override = overrideSituacaoFolha(conf);
      
      return {
        ...it,
        profissional: {
          ...it.profissional,
          situacao: override
        },
        linha: aplicarOverrideSituacao(base as any, override, CAMPOS_NUM as any),
      };
    });
  }


  const mSalvar = useMutation({
    mutationFn: async () => {
      const { offlineGuard } = await import("@/lib/offline-guard");
      if (offlineGuard()) throw new Error("Offline");

      const list = payloadDirty();
      console.log("DEBUG_SALVAMENTO: Payload enviado (Efetivos)", list);
      
      if (!list.length) return { ok: true, sem_alteracoes: true };
      
      try {
        const res = await salvarFn({
          data: { competencia_id: competenciaId, unidade_id: unidadeId, setor_id: setorUnico, linhas: list },
        });
        console.log("DEBUG_SALVAMENTO: Resposta servidor", res);
        return res;
      } catch (error) {
        console.log("DEBUG_SUPABASE: Erro recebido ao salvar", error);
        throw error;
      }
    },
    onSuccess: (r: any) => {
      if (r?.sem_alteracoes) toast.info("Nenhuma alteração para salvar.");
      else toast.success("Alterações salvas com sucesso!");
      // Só após confirmação de escrita as linhas deixam de ser "sujas".
      setLinhas((prev) => {
        const next: Record<string, LinhaState> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = { ...v, _dirty: false };
        return next;
      });
      qc.invalidateQueries({ queryKey: ["folha-efetivos", competenciaId, unidadeId] });
      qc.invalidateQueries({ queryKey: ["frequencia-resumo", competenciaId, unidadeId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar."),
  });

  const mEnviar = useMutation({
    mutationFn: async () => {
      const { offlineGuard } = await import("@/lib/offline-guard");
      if (offlineGuard()) throw new Error("Offline");

      const list = payloadDirty();
      if (list.length) {
        await salvarFn({
          data: { competencia_id: competenciaId, unidade_id: unidadeId, setor_id: setorUnico, linhas: list },
        });
      }
      
      return enviarFn({ data: { competencia_id: competenciaId, unidade_id: unidadeId, setor_id: setorUnico } });
    },
    onSuccess: (r: any) => {
      toast.success(`Enviado para aprovação (${r?.enviadas ?? 0} linhas).`);
      setEnviarAberto(false);
      setLinhas((prev) => {
        const next: Record<string, LinhaState> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = { ...v, _dirty: false };
        return next;
      });
      qc.invalidateQueries({ queryKey: ["folha-efetivos", competenciaId, unidadeId] });
      qc.invalidateQueries({ queryKey: ["frequencia-resumo", competenciaId, unidadeId] });
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
      if (setorFilter.length > 0 && setorFilter.length !== (setoresOpts?.length ?? 0) && !setorFilter.includes(p.setor_id || "")) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        (p.matricula ?? "").toLowerCase().includes(q) ||
        (p.cargo ?? "").toLowerCase().includes(q)
      );
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

  const canView = has("frequencia.visualizar");

  function openDossie(p: ProfConferencia) {
    setDossieProf(p);
    setDossieOpen(true);
  }

  /* ------- ERP grid: derivados de UI (sem impacto em back-end) ------- */
  const FROZEN: FrozenCol[] = [
    { key: "matricula", label: "Matrícula", width: 85 },
    { key: "nome", label: "Profissional", width: 230 },
    { key: "situacao", label: "Situação", width: 110 },
    { key: "proj", label: "Proj", width: 60 },
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
      const l = linhas[it.profissional.id];
      if (!l) continue;
      for (const k of colKeysAll) {
        const v = (l as any)[k];
        acc[k] += Number(normalizarParaSoma(v));
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
            const cur = next[rId];
            if (!cur) return;
            const raw = String(cell ?? "").trim();
            // Mantém o valor bruto se não for numérico puro (pode ser "Férias", "1,5", etc)
            // Se for numérico, normaliza para salvar consistentemente
            const n = normalizarParaSoma(raw);
            const finalValue = /^-?\d+([.,]\d+)?$/.test(raw) ? n : raw;
            next[rId] = { ...cur, [cKey]: finalValue, _dirty: true };
            touched++;
          });
        });
        if (touched) toast.success(`${touched} valor(es) colado(s).`);
        if (touched) {
          linhasRef.current = next;
          autosaveRef.current.flush();
        }
        return next;
      });
    },
    [rowIdsAll, colKeysAll],
  );

  const validateGeneric = (v: number | string) => {
    const n = normalizarParaSoma(v);
    return !isNaN(n) && n < 0 ? "Valor negativo" : null;
  };
  const validateHoras = (v: number | string) => {
    const n = normalizarParaSoma(v);
    return !isNaN(n) && n > 400 ? "Valor incomum (> 400h)" : null;
  };
  const validateFalta = (v: number | string) => {
    const n = normalizarParaSoma(v);
    return !isNaN(n) && n > 31 ? "Faltas acima de 31 dias" : null;
  };

  function focarLinha(rowId: string) {
    const tr = document.querySelector<HTMLTableRowElement>(
      `.erp-grid tr[data-row-id="${rowId.replace(/"/g, "")}"]`,
    );
    tr?.scrollIntoView({ block: "center", behavior: "smooth" });
    tr?.querySelector<HTMLInputElement>(".erp-cell-input")?.focus();
  }

  const [selectedRowId] = useSelectedErpRow();

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para visualizar frequências.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <FolhaBreadcrumb current="Folha Pagamento — Efetivos" />
      {prazoBloqueado && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{MSG_PRAZO_ENCERRADO}</span>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Folha — Efetivos</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Folha oficial de servidores estatutários (efetivos), com campos adicionais da SMS ao
            lado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AutosaveBadge status={autosave.status} onRetry={autosave.retry} />
          <Button
            variant="outline"
            onClick={() => mSalvar.mutate()}
            disabled={!canEdit || mSalvar.isPending}
          >
            <Save className="mr-1.5 h-4 w-4" /> Salvar rascunho
          </Button>
          <Button
            onClick={() => setEnviarAberto(true)}
            disabled={!canEnviar || mEnviar.isPending || !folha?.itens?.length}
          >
            <Send className="mr-1.5 h-4 w-4" /> Enviar para análise
          </Button>
          <Button
            variant="secondary"
            disabled={!competenciaId || !unidadeId}
            title="Gerar PDF no padrão oficial"
            onClick={async () => {
              try {
                const itensExportacao = itensParaExport();
                const unidadeNome =
                  unidadesVisiveis.find((u: any) => u.id === unidadeId)?.nome ?? "UNIDADE";
                const grupos: Record<
                  string,
                  { codigo_setor: string; nome_setor: string; itens: any[] }
                > = {};
                let seq = 1;
                for (const it of itensExportacao as any[]) {
                  const setor = it.profissional.setor ?? "SEM SETOR";
                  if (!grupos[setor]) {
                    grupos[setor] = { codigo_setor: String(seq++), nome_setor: setor, itens: [] };
                  }
                  const l = it.linha ?? {};
                  grupos[setor].itens.push({
                    profissional: it.profissional,
                    totais: {
                      dias_trabalhados: valorCelula(l.dias_trabalhados ?? 0),
                      dias_falta: valorCelula(l.faltas_injustificadas ?? 0),
                      atestado: valorCelula(l.atestado ?? 0),
                      maternidade: 0,
                      he_50: valorCelula(l.he_50 ?? 0),
                      he_100: valorCelula(l.he_100 ?? 0),
                      ferias_terco: valorCelula(l.ferias_terco ?? 0),
                      ferias_integral: valorCelula(l.ferias_integral ?? 0),
                      sal_sub_h: valorCelula(l.sal_sub_h ?? 0),
                      adicional_noturno: valorCelula(l.adicional_noturno ?? 0),
                      aulas_suplementares: valorCelula(l.aulas_suplementares ?? 0),
                      plantao: valorCelula(l.plantoes_extras ?? 0),
                      sobreaviso: valorCelula(l.sobreaviso ?? 0),
                      incentivo: valorCelula(l.incentivo ?? 0),
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
                const { gerarFolhaEfetivosOficial } =
                  await import("@/lib/pdf-folha-efetivos-oficial");
                await gerarFolhaEfetivosOficial({
                  competencia: {
                    mes: compSel?.mes ?? 1,
                    ano: compSel?.ano ?? new Date().getFullYear(),
                  },
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
          <Button
            variant="outline"
            disabled={!competenciaId || !unidadeId}
            title="Exportar Excel"
            onClick={async () => {
              try {
                const itensExportacao = itensParaExport();
                const unidadeNome =
                  unidadesVisiveis.find((u: any) => u.id === unidadeId)?.nome ?? "UNIDADE";
                const { gerarExcelFolhaEfetivos } = await import("@/lib/excel-folha-efetivos");
                await gerarExcelFolhaEfetivos({
                  competencia: {
                    mes: compSel?.mes ?? 1,
                    ano: compSel?.ano ?? new Date().getFullYear(),
                  },
                  unidadeNome,
                  itens: (itensExportacao as any[]).map((it) => ({
                    profissional: it.profissional,
                    linha: it.linha ?? null,
                  })),
                });
              } catch (e: any) {
                toast.error(e?.message ?? "Falha ao gerar Excel.");
              }
            }}
          >
            <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Exportar Excel
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">Competência</label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
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
          <UnidadeFilter
            value={unidadeId}
            onChange={(v) => setUnidadeId(v)}
            placeholder="Selecionar unidade"
            className="w-[200px]"
          />

        </div>
        <div>
          <label className="text-xs text-muted-foreground">Buscar</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, matrícula ou cargo"
              className="pl-8"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Cargo</label>
          <Select value={cargoFilter} onValueChange={setCargoFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {cargosOpts?.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Função</label>
          <Select value={funcaoFilter} onValueChange={setFuncaoFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              {funcoesOpts?.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
          <label className="text-xs text-muted-foreground block mb-1">Setor</label>
          <MultiSelect
            options={(setoresOpts ?? []).map((s: any) => ({ label: s.nome, value: s.id }))}
            onValueChange={setSetorFilter}
            defaultValue={setorFilter}
            placeholder={unidadeId ? "Selecionar Setores" : "Selecione uma unidade"}
            maxCount={2}
            disabled={!unidadeId}
          />
        </div>
      </div>

      {compFechada && (
        <div className="rounded-md border border-warning/40 bg-warning-soft text-warning-soft-foreground text-sm px-3 py-2">
          Competência encerrada — folha em modo somente leitura.
        </div>
      )}

      {/* Painel gerencial (UI-only) */}
      <div className="flex items-center justify-between gap-4">
        <KpiFolhaBar k={kpi} className="flex-1" />
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border bg-card shadow-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Status da Unidade:
          </span>
          <StatusBadge domain="frequencia" value={folhaStatus} />
        </div>
      </div>
      <ResumoDiasFaltasAtt
        totais={{
          dias: totCampo.dias_trabalhados ?? 0,
          faltas: totCampo.faltas_injustificadas ?? 0,
          att: totCampo.atestado ?? 0,
        }}
        selecionado={(() => {
          if (!selectedRowId) return null;
          const l = linhas[selectedRowId];
          const p = rowsConf.find((r) => r.id === selectedRowId);
          if (!l || !p) return null;
          return {
            nome: p.nome ?? "—",
            valores: {
              dias: Number(l.dias_trabalhados ?? 0),
              faltas: Number(l.faltas_injustificadas ?? 0),
              att: Number(l.atestado ?? 0),
            },
            status: l.status_linha,

          };
        })()}
      />
      <div className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
                <th
                  className="erp-sticky bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "left", left: L.matricula, width: 85 }}
                  rowSpan={2}
                >
                  Matrícula
                </th>
                <th
                  className="erp-sticky bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "left", left: L.nome, width: 230 }}
                  rowSpan={2}
                >
                  Profissional
                </th>
                <th
                  className="erp-sticky bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "left", left: L.situacao, width: 110 }}
                  rowSpan={2}
                >
                  Situação
                </th>
                <th
                  className="erp-sticky erp-sticky-last bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "right", left: L.proj, width: 60 }}
                  rowSpan={2}
                >
                  Proj
                </th>
                <th
                  className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "right" }}
                  rowSpan={2}
                >
                  H.P
                </th>
                <th
                  className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "right" }}
                  rowSpan={2}
                >
                  C.H
                </th>
                <th
                  className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-r border-slate-700"
                  style={{ textAlign: "right" }}
                  rowSpan={2}
                >
                  Jorn
                </th>
                <th
                  className="bg-teal-900! text-teal-100! font-bold text-xs uppercase tracking-wider border-x border-teal-700"
                  colSpan={CAMPOS_OFICIAIS.length}
                  style={{ textAlign: "center" }}
                >
                  Lançamentos — Modelo Oficial
                </th>
                <th
                  className="bg-amber-900! text-amber-100! font-bold text-xs uppercase tracking-wider border-x border-amber-700"
                  colSpan={CAMPOS_SMS.length}
                  style={{ textAlign: "center" }}
                >
                  Controles SMS
                </th>
                <th
                  className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider border-x border-slate-700"
                  rowSpan={2}
                  style={{ textAlign: "left", minWidth: 200 }}
                >
                  Observações
                </th>
                <th
                  className="bg-slate-900! text-white! font-bold text-xs uppercase tracking-wider"
                  rowSpan={2}
                  style={{ textAlign: "center" }}
                >
                  Status
                </th>
              </tr>
              <tr>
                {CAMPOS_OFICIAIS.map((c) => (
                  <th
                    key={c.key}
                    className="bg-teal-800! text-white! font-bold text-[10px] whitespace-nowrap border-r border-slate-700 w-[60px] min-w-[60px]"
                    style={{ textAlign: "right" }}
                  >
                    {c.label}
                  </th>
                ))}
                {CAMPOS_SMS.map((c) => (
                  <th
                    key={c.key}
                    className="bg-amber-800! text-white! font-bold text-[10px] whitespace-nowrap border-r border-slate-700 w-[60px] min-w-[60px]"
                    style={{ textAlign: "right" }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <ErpTbody>
              {isFetching && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="bg-slate-50 text-slate-600 font-medium py-8 text-center text-sm"
                  >
                    Carregando…
                  </td>
                </tr>
              )}
              {!isFetching && linhasFinais.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="bg-slate-50 text-slate-600 font-medium py-8 text-center text-sm"
                  >
                    Nenhum servidor efetivo nesta unidade.
                  </td>
                </tr>
              )}
              {linhasFinais.map(({ it, conf }) => {
                const p = it.profissional;
                const l = linhas[p.id];
                if (!l) return null;
<<<<<<< HEAD
                const statusLinha = ((it.linha as any)?.status_linha ?? "pendente") as string;
                const ro = !canEdit || !linhaEditavel(statusLinha);

=======
                const statusLinhaAtual = (it.linha as any)?.status_linha ?? "pendente";
                const podeCorrigirLinha = linhaEditavel({
                  statusLinha: statusLinhaAtual,
                  folhaStatus,
                  isGestor: isGestorPerfil,
                });
                const ro = !canEdit || !podeCorrigirLinha;
>>>>>>> b93b0880a607d07bfb337efda6e47d0aa1e80c0a
                const situ = derivarSituacao(conf);
                const overrideSituacao = overrideSituacaoFolha(conf);
                const CelulaSituacao = (
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={overrideSituacao ?? ""}
                    title={overrideSituacao ?? ""}
                    className="w-full truncate rounded border border-slate-200 bg-slate-100 px-1 text-right text-[10px] font-semibold text-slate-600"
                  />
                );
                return (
                  <tr key={p.id} data-row-id={p.id} data-situacao={situ}>
                    <td
                      className="erp-sticky"
                      style={{
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: 11,
                        left: L.matricula,
                        width: 85,
                      }}
                    >
                      {p.matricula ?? "—"}
                    </td>
                    <td className="erp-sticky" style={{ left: L.nome, width: 230 }}>
                      <ProfissionalNomeCell
                        prof={conf}
                        onOpenDossie={openDossie}
                        secondary={p.cargo}
                      />
                    </td>
                    <td className="erp-sticky" style={{ left: L.situacao, width: 110 }}>
                      <SituacaoBadge prof={conf} />
                    </td>
                    <td
                      className="erp-sticky erp-sticky-last text-right text-muted-foreground tabular-nums"
                      style={{ left: L.proj, width: 60 }}
                    >
                      {p.proj ?? "-"}
                    </td>
                    <td className="text-right text-muted-foreground tabular-nums">
                      {p.h_p ?? "-"}
                    </td>
                    <td className="text-right text-muted-foreground tabular-nums">
                      {p.c_h ?? "-"}
                    </td>
                    <td className="text-right text-muted-foreground tabular-nums">
                      {p.jorn ?? "-"}
                    </td>
                    {CAMPOS_OFICIAIS.map((c) => {
                      const isFalta = c.key === "faltas_injustificadas";
                      const isHora =
                        c.key === "he_50" ||
                        c.key === "he_100" ||
                        c.key === "sal_sub_h" ||
                        c.key === "adicional_noturno";
                      return (
                        <td key={c.key} className="erp-group-lanc">
                          {overrideSituacao ? CelulaSituacao : <NumberCell
                            rowId={p.id}
                            colKey={c.key}
                            value={(l as any)[c.key] ?? ""}
                            disabled={ro}
                            decimals={0}
                            className="w-full text-right text-[11px]"
                            validate={
                              isFalta ? validateFalta : isHora ? validateHoras : validateGeneric
                            }
                            onChange={(v) => updateCampo(p.id, c.key as keyof LinhaState, v)}
                          />}
                        </td>
                      );
                    })}
                    {CAMPOS_SMS.map((c) => (
                      <td key={c.key} className="erp-group-sms">
                        {overrideSituacao ? CelulaSituacao : <NumberCell
                          rowId={p.id}
                          colKey={c.key}
                          value={(l as any)[c.key] ?? ""}
                          disabled={ro}
                          className="w-full text-right text-[11px]"
                          validate={validateGeneric}
                          onChange={(v) => updateCampo(p.id, c.key as keyof LinhaState, v)}
                        />}
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
<<<<<<< HEAD
                      <StatusBadge
                        domain="linha"
                        value={statusLinha}
                        title={
                          (it.linha as any)?.observacao_analise
                            ? `Motivo: ${(it.linha as any).observacao_analise}`
                            : undefined
                        }
                      />
=======
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wide ${statusLinhaClass(statusLinhaAtual)}`}
                        title={ro && canEdit ? MSG_LINHA_BLOQUEADA : undefined}
                      >
                        {statusLinhaLabel(statusLinhaAtual)}
                      </Badge>
>>>>>>> b93b0880a607d07bfb337efda6e47d0aa1e80c0a
                    </td>

                  </tr>
                );
              })}
            </ErpTbody>
            <tfoot>
              <tr>
                <td className="erp-sticky" style={{ left: L.matricula, width: 85 }}></td>
                <td className="erp-sticky" style={{ left: L.nome, width: 230 }}>
                  Totais
                </td>
                <td className="erp-sticky" style={{ left: L.situacao, width: 110 }}></td>
                <td className="erp-sticky erp-sticky-last" style={{ left: L.proj, width: 60 }}></td>
                <td colSpan={3}></td>
                {CAMPOS_OFICIAIS.map((c) => (
                  <td key={c.key} className="erp-group-lanc" style={{ textAlign: "right" }}>
                    {(totCampo[c.key] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                  </td>
                ))}
                {CAMPOS_SMS.map((c) => (
                  <td key={c.key} className="erp-group-sms" style={{ textAlign: "right" }}>
                    {(totCampo[c.key] ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
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
        <strong>Proj</strong>, <strong>H.P</strong>, <strong>C.H</strong> e <strong>Jorn</strong>{" "}
        são somente leitura — vêm do cadastro do profissional. Os campos em amarelo (
        <em>Férias indicativo</em>, <em>Licença-Prêmio</em>) são controles internos da SMS e não
        fazem parte do modelo oficial da Prefeitura.
      </p>

      <ProfissionalEdicaoModal
        prof={dossieProf}
        linha={dossieProf ? linhas[dossieProf.id] : undefined}
        open={dossieOpen}
        onOpenChange={setDossieOpen}
        canEdit={canEdit}
        statusValue={dossieProf ? linhas[dossieProf.id]?.status_linha : undefined}
        onStatusChange={(v) => {
          if (dossieProf) {
            updateCampo(dossieProf.id, "status_linha", v as StatusFreq);
          }
        }}
        campos={[
          ...CAMPOS_OFICIAIS.map((c) => ({
            key: c.key,
            label: c.label,
            decimals: 0,
            group: "oficial" as const,
          })),
          ...CAMPOS_SMS.map((c) => ({
            key: c.key,
            label: c.label,
            decimals: 0,
            group: "sms" as const,
          })),
        ]}
        onChangeCampo={(campo, valor) => {
          if (!dossieProf) return;
          updateCampo(dossieProf.id, campo as keyof LinhaState, valor);
        }}
        onSave={async () => {
          await mSalvar.mutateAsync();
          setDossieOpen(false);
        }}
        saving={mSalvar.isPending}
        anexosSlot={
          <LinhaAnexos
            frequenciaProfissionalId={
              dossieProf
                ? ((folha?.itens as any[] | undefined)?.find(
                    (it: any) => it.profissional.id === dossieProf.id,
                  )?.linha?.id ?? null)
                : null
            }
            unidadeId={unidadeId}
            canEdit={canEdit}
            competenciaId={competenciaId}
            profissionalId={dossieProf?.id ?? null}
            folha="efetivos"
          />
        }
      />

      <EnviarFolhaDialog
        open={enviarAberto}
        onOpenChange={setEnviarAberto}
        competenciaId={competenciaId}
        unidadeId={unidadeId}
        setorId={setorFilter.length === 1 ? setorFilter[0] : null}
        folha="efetivos"
        statusLinha={folhaStatus}
        enviando={mEnviar.isPending}
        onConfirm={() => mEnviar.mutate()}
      />
    </div>
  );
}
