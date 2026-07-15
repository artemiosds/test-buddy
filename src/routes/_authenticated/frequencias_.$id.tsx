import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  salvarLinhasFrequencia,
  alterarStatusFrequencia,
  abrirPendenciaLinha,
  inserirLinhasAuto,
  registrarAnexoLinha,
} from "@/lib/frequencias.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send, CheckCircle2, XCircle, Save, Plus, Trash2, FileDown, Paperclip, Upload, Copy, Flag, AlertCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawInstitutionalHeader, drawSignatureFooter, loadMunicipioInfo } from "@/lib/pdf-institucional";
import { registrarDocumentoAssinado, drawSignatureStamp } from "@/lib/pdf-signature";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/frequencias_/$id")({
  component: FrequenciaDetalhe,
});

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];
type StatusLinha = Database["public"]["Enums"]["status_linha_frequencia"];

type NumField =
  | "dias_trabalhados"
  | "faltas_justificadas"
  | "faltas_injustificadas"
  | "ferias"
  | "licencas"
  | "afastamentos"
  | "horas_extras"
  | "plantoes_extras"
  | "adicional_noturno"
  | "atestado"
  | "he_50"
  | "he_100"
  | "sobreaviso"
  | "incentivo"
  | "licenca_premio"
  | "ferias_terco"
  | "ferias_integral"
  | "sal_sub_h"
  | "aulas_suplementares";

const ALL_NUM_FIELDS: NumField[] = [
  "dias_trabalhados", "faltas_justificadas", "faltas_injustificadas", "ferias",
  "licencas", "afastamentos", "horas_extras", "plantoes_extras", "adicional_noturno",
  "atestado", "he_50", "he_100", "sobreaviso", "incentivo", "licenca_premio",
  "ferias_terco", "ferias_integral", "sal_sub_h", "aulas_suplementares",
];



type Linha = {
  id?: string;
  profissional_id: string;
  dias_trabalhados: number;
  faltas_justificadas: number;
  faltas_injustificadas: number;
  ferias: number;
  licencas: number;
  afastamentos: number;
  horas_extras: number;
  plantoes_extras: number;
  adicional_noturno: number;
  atestado: number;
  he_50: number;
  he_100: number;
  sobreaviso: number;
  incentivo: number;
  licenca_premio: number;
  ferias_terco: number;
  ferias_integral: number;
  sal_sub_h: number;
  aulas_suplementares: number;
  observacoes: string | null;
  status_linha: StatusLinha;
  observacao_analise: string | null;
  _dirty?: boolean;
  _new?: boolean;
};

const STATUS_LINHA_LABEL: Record<StatusLinha, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};
const STATUS_LINHA_VARIANT: Record<StatusLinha, "outline" | "secondary" | "destructive"> = {
  pendente: "outline",
  aprovada: "secondary",
  rejeitada: "destructive",
};

const STATUS_LABEL: Record<StatusFreq, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  em_analise: "Em análise",
  com_pendencias: "Com pendências",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  arquivada: "Arquivada",
};

type Natureza = Database["public"]["Enums"]["natureza_vinculo"];
const NATUREZAS_EFETIVOS: Natureza[] = ["estatutario", "comissionado"];
const NATUREZAS_CONTRATADOS: Natureza[] = ["celetista", "temporario", "terceirizado", "estagiario", "residente", "voluntario"];

type ColunaDef = { field: NumField; label: string; extra?: boolean };

const COLS_CONTRATADOS: ColunaDef[] = [
  { field: "faltas_injustificadas", label: "Dias Falta" },
  { field: "atestado", label: "Atestado" },
  { field: "he_50", label: "HE 50%" },
  { field: "he_100", label: "HE 100%" },
  { field: "adicional_noturno", label: "ADN" },
  { field: "plantoes_extras", label: "Plantões" },
  { field: "sobreaviso", label: "Sobreaviso" },
  { field: "incentivo", label: "Incentivo" },
];

// Efetivos — ordem oficial (modelo AGILIBlue / Prefeitura), seguida de "Campos adicionais SMS"
const COLS_EFETIVOS: ColunaDef[] = [
  { field: "faltas_injustificadas", label: "Dias Falta" },
  { field: "atestado", label: "ATT" },
  { field: "he_50", label: "HE 50%" },
  { field: "he_100", label: "HE 100%" },
  { field: "ferias_terco", label: "Férias 1/3" },
  { field: "ferias_integral", label: "Férias Integral" },
  { field: "sal_sub_h", label: "Sal./Sub.H" },
  { field: "adicional_noturno", label: "Adic. Not" },
  { field: "aulas_suplementares", label: "Aulas Suple." },
  { field: "sobreaviso", label: "Sobreaviso" },
  { field: "plantoes_extras", label: "Plantão" },
  { field: "incentivo", label: "Incentivo" },
  // Extras SMS (fora do modelo oficial)
  { field: "ferias", label: "Férias", extra: true },
  { field: "licenca_premio", label: "Licença-Prêmio", extra: true },
];

function novaLinha(profissional_id: string, novo = true): Linha {
  return {
    profissional_id,
    dias_trabalhados: 0,
    faltas_justificadas: 0,
    faltas_injustificadas: 0,
    ferias: 0,
    licencas: 0,
    afastamentos: 0,
    horas_extras: 0,
    plantoes_extras: 0,
    adicional_noturno: 0,
    atestado: 0,
    he_50: 0,
    he_100: 0,
    sobreaviso: 0,
    incentivo: 0,
    licenca_premio: 0,
    ferias_terco: 0,
    ferias_integral: 0,
    sal_sub_h: 0,
    aulas_suplementares: 0,
    observacoes: null,
    status_linha: "pendente",
    observacao_analise: null,
    _new: novo,
    _dirty: novo,
  };
}

function FrequenciaDetalhe() {
  const { id } = Route.useParams();
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [obs, setObs] = useState("");
  const [anexosOpenFor, setAnexosOpenFor] = useState<Linha | null>(null);
  const [copiarDialog, setCopiarDialog] = useState<null | { prevLabel: string; prevRows: Array<{ profissional_id: string } & Record<string, number>>; prevProfIds: Set<string> }>(null);
  const [pendFor, setPendFor] = useState<Linha | null>(null);
  const [pendTitulo, setPendTitulo] = useState("");
  const [pendDesc, setPendDesc] = useState("");
  const autoAdded = useRef(false);
  const inputsRef = useRef<(HTMLInputElement | null)[][]>([]);
  const canGerenciarPend = has("pendencia.gerenciar");

  const { data: frequencia } = useQuery({
    queryKey: ["frequencia", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("frequencias")
        .select("id, tipo, status, observacoes, competencia_unidade_id, competencia_unidades(id, unidade_id, competencia_id, unidades(id, nome, sigla), competencias(id, ano, mes, prazo_envio))")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (frequencia?.observacoes != null) setObs(frequencia.observacoes);
  }, [frequencia?.observacoes]);

  const unidadeId = frequencia?.competencia_unidades?.unidade_id;
  const tipo = frequencia?.tipo;
  const isEfetivo = tipo === "efetivos";
  const colunas = isEfetivo ? COLS_EFETIVOS : COLS_CONTRATADOS;
  const firstExtraIdx = colunas.findIndex((c) => c.extra);
  const fmtRef = (v: number | null | undefined) => (v == null ? "—" : String(v));

  const { data: profissionais } = useQuery({
    queryKey: ["profissionais-unidade", unidadeId, tipo],
    enabled: !!unidadeId && !!tipo,
    queryFn: async () => {
      const naturezas = tipo === "efetivos" ? NATUREZAS_EFETIVOS : NATUREZAS_CONTRATADOS;
      const { data, error } = await supabase.from("profissionais")
        .select("id, nome_completo, matricula, cpf, cargo_id, funcao_id, vinculo_id, proj, h_p, c_h, jorn, vinculos!inner(id, nome, natureza)")
        .eq("unidade_id", unidadeId!)
        .eq("status", "ativo")
        .in("vinculos.natureza", naturezas)
        .order("nome_completo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rowsExistentes, isLoading: loadingRows } = useQuery({
    queryKey: ["frequencia-profissional", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("frequencia_profissional")
        .select("*").eq("frequencia_id", id).is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!rowsExistentes) return;
    setLinhas(rowsExistentes.map((r) => ({
      id: r.id,
      profissional_id: r.profissional_id,
      dias_trabalhados: Number(r.dias_trabalhados) || 0,
      faltas_justificadas: Number(r.faltas_justificadas) || 0,
      faltas_injustificadas: Number(r.faltas_injustificadas) || 0,
      ferias: Number(r.ferias) || 0,
      licencas: Number(r.licencas) || 0,
      afastamentos: Number(r.afastamentos) || 0,
      horas_extras: Number(r.horas_extras) || 0,
      plantoes_extras: Number(r.plantoes_extras) || 0,
      adicional_noturno: Number(r.adicional_noturno) || 0,
      atestado: Number(r.atestado) || 0,
      he_50: Number(r.he_50) || 0,
      he_100: Number(r.he_100) || 0,
      sobreaviso: Number(r.sobreaviso) || 0,
      incentivo: Number(r.incentivo) || 0,
      licenca_premio: Number(r.licenca_premio) || 0,
      ferias_terco: Number((r as unknown as { ferias_terco?: number }).ferias_terco) || 0,
      ferias_integral: Number((r as unknown as { ferias_integral?: number }).ferias_integral) || 0,
      sal_sub_h: Number((r as unknown as { sal_sub_h?: number }).sal_sub_h) || 0,
      aulas_suplementares: Number((r as unknown as { aulas_suplementares?: number }).aulas_suplementares) || 0,
      observacoes: r.observacoes,
      status_linha: r.status_linha,
      observacao_analise: r.observacao_analise,
    })));
  }, [rowsExistentes]);

  // Busca dados dos profissionais referenciados nas linhas existentes que
  // eventualmente não apareçam no filtro da unidade/tipo (ex.: transferência,
  // inativação posterior, mudança de vínculo). Garante que a planilha nunca
  // exiba UUID cru + "Mat. —" para linhas já persistidas.
  const linhaProfIds = useMemo(
    () => Array.from(new Set((rowsExistentes ?? []).map((r) => r.profissional_id))),
    [rowsExistentes],
  );
  const { data: profissionaisLinhas } = useQuery({
    queryKey: ["profissionais-linhas", id, linhaProfIds],
    enabled: linhaProfIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profissionais")
        .select("id, nome_completo, matricula, cpf, cargo_id, funcao_id, vinculo_id, proj, h_p, c_h, jorn, vinculos(id, nome, natureza)")
        .in("id", linhaProfIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  type ProfLite = {
    id: string;
    nome_completo: string;
    matricula: string | null;
    cpf?: string | null;
    cargo_id?: string | null;
    funcao_id?: string | null;
    vinculo_id?: string | null;
    proj?: number | null;
    h_p?: number | null;
    c_h?: number | null;
    jorn?: number | null;
    vinculos?: { id: string; nome: string; natureza: string } | null;
  };

  const profMap = useMemo(() => {
    const m = new Map<string, ProfLite>();
    (profissionais ?? []).forEach((p) => m.set(p.id, p as unknown as ProfLite));
    (profissionaisLinhas ?? []).forEach((p) => {
      if (!m.has(p.id)) m.set(p.id, p as unknown as ProfLite);
    });
    return m;
  }, [profissionais, profissionaisLinhas]);

  const editable = frequencia?.status === "rascunho" || frequencia?.status === "com_pendencias";
  const canEditar = has("frequencia.editar");

  // Contagem de pendências abertas/respondidas por linha (frequencia_profissional_id)
  const { data: pendCounts } = useQuery({
    queryKey: ["frequencia-pendencias-por-linha", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select("id, status, frequencia_profissional_id")
        .eq("frequencia_id", id)
        .is("deleted_at", null)
        .in("status", ["aberta", "respondida"]);
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((p) => {
        if (!p.frequencia_profissional_id) return;
        map.set(p.frequencia_profissional_id, (map.get(p.frequencia_profissional_id) ?? 0) + 1);
      });
      return map;
    },
  });

  const abrirPendFn = useServerFn(abrirPendenciaLinha);
  const abrirPendMutation = useMutation({
    mutationFn: async () => {
      if (!pendFor?.id) throw new Error("Salve a linha antes de abrir pendência.");
      if (!pendTitulo.trim()) throw new Error("Informe o título da pendência.");
      await abrirPendFn({
        data: {
          frequencia_id: id,
          frequencia_profissional_id: pendFor.id,
          titulo: pendTitulo.trim(),
          descricao: pendDesc.trim(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Pendência aberta");
      setPendFor(null);
      setPendTitulo("");
      setPendDesc("");
      qc.invalidateQueries({ queryKey: ["frequencia-pendencias-por-linha", id] });
      qc.invalidateQueries({ queryKey: ["frequencia", id] });
      qc.invalidateQueries({ queryKey: ["pendencias"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const naoAdicionados = (profissionais ?? []).filter((p) => !linhas.some((l) => l.profissional_id === p.id));

  // Rascunho automático: ao carregar, insere linhas faltantes para todos os profissionais ativos
  const autoInsertFn = useServerFn(inserirLinhasAuto);
  const autoInsertMutation = useMutation({
    mutationFn: async (pids: string[]) => {
      await autoInsertFn({ data: { frequencia_id: id, profissional_ids: pids } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frequencia-profissional", id] });
    },
  });

  useEffect(() => {
    if (autoAdded.current) return;
    if (!editable || !canEditar) return;
    if (!profissionais || !rowsExistentes) return;
    const faltantes = profissionais
      .filter((p) => !rowsExistentes.some((r) => r.profissional_id === p.id))
      .map((p) => p.id);
    if (faltantes.length > 0) {
      autoAdded.current = true;
      autoInsertMutation.mutate(faltantes);
    } else {
      autoAdded.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profissionais, rowsExistentes, editable, canEditar]);

  const addProfissional = (pid: string) => {
    setLinhas((prev) => [...prev, novaLinha(pid)]);
  };

  const addTodos = () => {
    setLinhas((prev) => [...prev, ...naoAdicionados.map((p) => novaLinha(p.id))]);
  };

  const updateLinha = (idx: number, patch: Partial<Linha>) => {
    setLinhas((prev) => prev.map((l, i) => i === idx ? { ...l, ...patch, _dirty: true } : l));
  };

  const removeLinha = (idx: number) => {
    setLinhas((prev) => prev.filter((_, i) => i !== idx));
  };

  // === Item 10: Copiar mês anterior ===
  const planilhaVazia = linhas.length > 0 && linhas.every(
    (l) => ALL_NUM_FIELDS.every((f) => Number(l[f]) === 0),
  );

  const abrirCopiarPrevia = async () => {
    if (!frequencia || !comp || !cu?.unidade_id) return;
    const prevMes = comp.mes === 1 ? 12 : comp.mes - 1;
    const prevAno = comp.mes === 1 ? comp.ano - 1 : comp.ano;
    const prevLabel = `${String(prevMes).padStart(2, "0")}/${prevAno}`;
    try {
      const { data: prevComp, error: e1 } = await supabase
        .from("competencias")
        .select("id")
        .eq("mes", prevMes).eq("ano", prevAno)
        .is("deleted_at", null)
        .limit(1).maybeSingle();
      if (e1) throw e1;
      if (!prevComp) { toast.error(`Não há competência anterior (${prevLabel}) cadastrada.`); return; }

      const { data: prevCU, error: e2 } = await supabase
        .from("competencia_unidades")
        .select("id")
        .eq("competencia_id", prevComp.id)
        .eq("unidade_id", cu.unidade_id)
        .is("deleted_at", null)
        .limit(1).maybeSingle();
      if (e2) throw e2;
      if (!prevCU) { toast.error(`Unidade não teve competência ${prevLabel}.`); return; }

      const { data: prevFreq, error: e3 } = await supabase
        .from("frequencias")
        .select("id")
        .eq("competencia_unidade_id", prevCU.id)
        .eq("tipo", frequencia.tipo)
        .is("deleted_at", null)
        .limit(1).maybeSingle();
      if (e3) throw e3;
      if (!prevFreq) { toast.error(`Não há folha ${frequencia.tipo} na competência ${prevLabel}.`); return; }

      const { data: prevRowsRaw, error: e4 } = await supabase
        .from("frequencia_profissional")
        .select("profissional_id, dias_trabalhados, faltas_justificadas, faltas_injustificadas, ferias, licencas, afastamentos, horas_extras, plantoes_extras, adicional_noturno, atestado, he_50, he_100, sobreaviso, incentivo, licenca_premio, ferias_terco, ferias_integral, sal_sub_h, aulas_suplementares")
        .eq("frequencia_id", prevFreq.id)
        .is("deleted_at", null);
      if (e4) throw e4;

      const prevRows = (prevRowsRaw ?? []).map((r) => r as unknown as Record<string, number> & { profissional_id: string });
      const prevProfIds = new Set(prevRows.map((r) => r.profissional_id));
      setCopiarDialog({ prevLabel, prevRows, prevProfIds });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const confirmarCopiar = () => {
    if (!copiarDialog) return;
    const mapa = new Map<string, { profissional_id: string } & Record<string, number>>();
    copiarDialog.prevRows.forEach((r) => mapa.set(r.profissional_id, r));
    setLinhas((prev) => {
      const proximos = prev.map((l) => {
        const eZero = ALL_NUM_FIELDS.every((f) => Number(l[f]) === 0);
        if (!eZero) return l;
        const src = mapa.get(l.profissional_id);
        if (!src) return l;
        const patch: Partial<Linha> = {};
        for (const f of ALL_NUM_FIELDS) patch[f] = Number(src[f]) || 0;
        return { ...l, ...patch, status_linha: "pendente" as StatusLinha, observacao_analise: null, _dirty: true };
      });
      // profissionais que existiam antes mas não estão na planilha atual → adicionar zerados
      const idsAtuais = new Set(proximos.map((l) => l.profissional_id));
      const faltantes = [...copiarDialog.prevProfIds].filter((pid) => !idsAtuais.has(pid) && (profissionais ?? []).some((p) => p.id === pid));
      for (const pid of faltantes) proximos.push(novaLinha(pid));
      return proximos;
    });
    setCopiarDialog(null);
    toast.success(`Valores de ${copiarDialog.prevLabel} copiados. Confira e clique em Salvar.`);
  };

  // === Item 11: Navegação tipo planilha ===
  const isRowEditable = (l: Linha) => !!editable && !!canEditar && l.status_linha === "pendente";

  const findNextEditableRow = (fromIdx: number, dir: 1 | -1) => {
    for (let i = fromIdx + dir; i >= 0 && i < linhas.length; i += dir) {
      if (isRowEditable(linhas[i])) return i;
    }
    return -1;
  };

  const focusCell = (r: number, c: number) => {
    const el = inputsRef.current[r]?.[c];
    if (el) { el.focus(); el.select(); }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const nr = findNextEditableRow(r, 1);
      if (nr >= 0) focusCell(nr, c);
    } else if (e.key === "Tab") {
      // Tab natural funciona bem entre inputs na ordem do DOM (esq→dir, próxima linha)
      // Só interceptamos para pular linhas não-editáveis
      if (!e.shiftKey && c === colunas.length - 1) {
        const nr = findNextEditableRow(r, 1);
        if (nr >= 0) { e.preventDefault(); focusCell(nr, 0); }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      const nr = findNextEditableRow(r, -1);
      if (nr >= 0) {
        const field = colunas[c].field;
        updateLinha(r, { [field]: Number(linhas[nr][field]) || 0 } as Partial<Linha>);
      }
    }
  };

  const handleCellPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\t") && !text.includes("\n")) return; // deixa colar valor único normalmente
    e.preventDefault();
    const rows = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n").map((line) => line.split("\t"));
    // Valida numéricos
    const errors: string[] = [];
    rows.forEach((cells, dr) => cells.forEach((raw, dc) => {
      const v = raw.trim().replace(",", ".");
      if (v === "") return;
      if (!Number.isFinite(Number(v))) errors.push(`L${r + dr + 1}·C${colunas[c + dc]?.label ?? c + dc + 1}`);
    }));
    if (errors.length) {
      toast.error(`Valores inválidos em: ${errors.slice(0, 5).join(", ")}${errors.length > 5 ? "..." : ""}`);
      return;
    }
    setLinhas((prev) => prev.map((l, idx) => {
      const dr = idx - r;
      if (dr < 0 || dr >= rows.length) return l;
      if (!isRowEditable(l)) return l;
      const cells = rows[dr];
      const patch: Partial<Linha> = {};
      cells.forEach((raw, dc) => {
        const targetCol = c + dc;
        if (targetCol >= colunas.length) return;
        const v = raw.trim().replace(",", ".");
        if (v === "") return;
        patch[colunas[targetCol].field] = Number(v);
      });
      return { ...l, ...patch, _dirty: true };
    }));
    toast.success(`${rows.length} linha(s) coladas.`);
  };


  const salvarFn = useServerFn(salvarLinhasFrequencia);
  const salvarMutation = useMutation({
    mutationFn: async () => {
      const idsManter = linhas.filter((l) => l.id).map((l) => l.id!);
      await salvarFn({
        data: {
          frequencia_id: id,
          observacoes: obs,
          ids_manter: idsManter,
          linhas: linhas.map((l) => ({
            id: l.id ?? null,
            _new: !!l._new,
            _dirty: !!l._dirty,
            profissional_id: l.profissional_id,
            dias_trabalhados: Number(l.dias_trabalhados) || 0,
            faltas_justificadas: Number(l.faltas_justificadas) || 0,
            faltas_injustificadas: Number(l.faltas_injustificadas) || 0,
            ferias: Number(l.ferias) || 0,
            licencas: Number(l.licencas) || 0,
            afastamentos: Number(l.afastamentos) || 0,
            horas_extras: Number(l.horas_extras) || 0,
            plantoes_extras: Number(l.plantoes_extras) || 0,
            adicional_noturno: Number(l.adicional_noturno) || 0,
            atestado: Number(l.atestado) || 0,
            he_50: Number(l.he_50) || 0,
            he_100: Number(l.he_100) || 0,
            sobreaviso: Number(l.sobreaviso) || 0,
            incentivo: Number(l.incentivo) || 0,
            licenca_premio: Number(l.licenca_premio) || 0,
            ferias_terco: Number(l.ferias_terco) || 0,
            ferias_integral: Number(l.ferias_integral) || 0,
            sal_sub_h: Number(l.sal_sub_h) || 0,
            aulas_suplementares: Number(l.aulas_suplementares) || 0,
            observacoes: l.observacoes ?? null,
          })),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frequencia-profissional", id] });
      qc.invalidateQueries({ queryKey: ["frequencia", id] });
      toast.success("Frequência salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const alterarStatusFn = useServerFn(alterarStatusFrequencia);
  const statusMutation = useMutation({
    mutationFn: async (status: StatusFreq) => {
      await alterarStatusFn({ data: { frequencia_id: id, status } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["frequencia", id] });
      qc.invalidateQueries({ queryKey: ["aprovacoes-list"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canEnviar = has("frequencia.enviar");
  const canAprovar = has("frequencia.aprovar");
  const canRejeitar = has("frequencia.rejeitar");

  const cu = frequencia?.competencia_unidades;
  const comp = cu?.competencias;

  const { data: parametros } = useMunicipioParametros();

  const { data: feriadosMes = [] } = useQuery({
    queryKey: ["feriados-mes", comp?.ano, comp?.mes],
    enabled: !!comp,
    queryFn: async () => {
      if (!comp) return [] as { data: string }[];
      const ini = `${comp.ano}-${String(comp.mes).padStart(2, "0")}-01`;
      const last = new Date(comp.ano, comp.mes, 0).getDate();
      const fim = `${comp.ano}-${String(comp.mes).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
      const { data, error } = await supabase
        .from("calendario_institucional")
        .select("data, tipo")
        .is("deleted_at", null)
        .in("tipo", ["feriado_nacional", "feriado_estadual", "feriado_municipal"])
        .gte("data", ini)
        .lte("data", fim);
      if (error) return [];
      return (data ?? []) as { data: string }[];
    },
  });

  const diasUteis = useMemo(() => {
    if (!comp) return null;
    const last = new Date(comp.ano, comp.mes, 0).getDate();
    const feriadosSet = new Set(feriadosMes.map((f) => f.data));
    let total = 0;
    for (let d = 1; d <= last; d++) {
      const dt = new Date(comp.ano, comp.mes - 1, d);
      const dow = dt.getDay(); // 0 dom, 6 sab
      if (dow === 0 || dow === 6) continue;
      const iso = `${comp.ano}-${String(comp.mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (feriadosSet.has(iso)) continue;
      total++;
    }
    return total;
  }, [comp, feriadosMes]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazoEnvio = comp?.prazo_envio ? new Date(comp.prazo_envio + "T00:00:00") : null;
  const foraDoPrazo = !!prazoEnvio && hoje > prazoEnvio;
  const permitirForaPrazo = parametros?.permitir_envio_fora_prazo === true;
  const envioBloqueado = foraDoPrazo && !permitirForaPrazo;



  const exportarPDF = async () => {
    if (!frequencia) return;
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const unidade = cu?.unidades?.nome ?? "—";
    const compLabel = comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "—";

    const info = await loadMunicipioInfo();
    const startY = drawInstitutionalHeader(
      doc,
      info,
      `Folha de Frequência — ${frequencia.tipo.toUpperCase()}`,
    );
    doc.setFontSize(10);
    doc.text(`Unidade: ${unidade}`, 14, startY + 4);
    doc.text(`Competência: ${compLabel}`, 14, startY + 10);
    doc.text(`Status: ${STATUS_LABEL[frequencia.status]}`, 14, startY + 16);

    autoTable(doc, {
      startY: startY + 22,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["#", "Profissional", ...colunas.map((c) => c.label), "Análise"]],
      body: linhas.map((l, i) => {
        const p = profMap.get(l.profissional_id);
        return [
          String(i + 1),
          p?.nome_completo ?? l.profissional_id,
          ...colunas.map((c) => l[c.field]),
          STATUS_LINHA_LABEL[l.status_linha],
        ];
      }),
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
    doc.setFontSize(9);
    if (obs) {
      doc.text("Observações:", 14, finalY + 8);
      doc.text(doc.splitTextToSize(obs, 260), 14, finalY + 13);
    }

    drawSignatureFooter(doc, doc.internal.pageSize.getHeight() - 60);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, pageHeight - 8);

    try {
      const sig = await registrarDocumentoAssinado({
        tipo: "frequencia",
        referencia_id: frequencia.id,
        descricao: `Folha de Frequência ${frequencia.tipo.toUpperCase()} — ${unidade} — ${compLabel}`,
        dados: {
          frequencia_id: frequencia.id,
          unidade,
          competencia: compLabel,
          tipo: frequencia.tipo,
          total_linhas: linhas.length,
        },
      });
      drawSignatureStamp(doc, sig);
    } catch (err) {
      console.error("Falha ao registrar assinatura digital:", err);
    }

    doc.save(`frequencia-${unidade}-${compLabel.replace("/", "-")}.pdf`);
  };

  if (!frequencia) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/frequencias"><ArrowLeft className="mr-1 h-4 w-4" />Voltar</Link>
        </Button>
        <div className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              {cu?.unidades?.nome} — <span className="capitalize">{frequencia.tipo}</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Competência {comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "—"} · {linhas.length} profissional(is)
              {diasUteis !== null && (
                <> · <span className="font-medium text-foreground">Dias úteis da competência: {diasUteis}</span></>
              )}
            </p>
          </div>
          <Badge variant="secondary">{STATUS_LABEL[frequencia.status]}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {canEditar && editable && (
          <Button size="sm" onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}>
            <Save className="mr-1 h-4 w-4" />Salvar
          </Button>
        )}
        {canEnviar && frequencia.status === "rascunho" && (
          <div className="flex flex-col">
            <Button
              size="sm"
              variant="default"
              disabled={envioBloqueado}
              title={envioBloqueado ? "Envio bloqueado: prazo da competência expirado" : undefined}
              onClick={() => statusMutation.mutate("enviada")}
            >
              <Send className="mr-1 h-4 w-4" />Enviar para análise
            </Button>
            {envioBloqueado && (
              <span className="mt-1 text-xs text-destructive">
                Prazo de envio expirou em {prazoEnvio?.toLocaleDateString("pt-BR")}. Solicite à SMS
                liberar "envio fora do prazo" na Configuração.
              </span>
            )}
            {foraDoPrazo && permitirForaPrazo && (
              <span className="mt-1 text-xs text-amber-600">
                Envio fora do prazo — será registrado em auditoria.
              </span>
            )}
          </div>
        )}
        {canAprovar && (frequencia.status === "enviada" || frequencia.status === "em_analise") && (
          <Button size="sm" variant="default" onClick={() => statusMutation.mutate("aprovada")}>
            <CheckCircle2 className="mr-1 h-4 w-4" />Aprovar
          </Button>
        )}
        {canRejeitar && (frequencia.status === "enviada" || frequencia.status === "em_analise") && (
          <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate("com_pendencias")}>
            <XCircle className="mr-1 h-4 w-4" />Retornar com pendências
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={exportarPDF} disabled={!linhas.length}>
          <FileDown className="mr-1 h-4 w-4" />Exportar PDF
        </Button>
        {editable && canEditar && planilhaVazia && (
          <Button size="sm" variant="outline" onClick={abrirCopiarPrevia}>
            <Copy className="mr-1 h-4 w-4" />Copiar mês anterior
          </Button>
        )}
      </div>

      {editable && canEditar && naoAdicionados.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
          <span className="text-sm text-muted-foreground">
            {naoAdicionados.length} profissional(is) ainda não incluídos.
          </span>
          <Button size="sm" variant="outline" onClick={addTodos}>
            <Plus className="mr-1 h-4 w-4" />Adicionar todos
          </Button>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        {loadingRows ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !linhas.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum profissional adicionado à planilha.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-2">Profissional</th>
                {isEfetivo && (
                  <>
                    <th className="p-2 whitespace-nowrap bg-muted/30">Proj</th>
                    <th className="p-2 whitespace-nowrap bg-muted/30">H.P</th>
                    <th className="p-2 whitespace-nowrap bg-muted/30">C.H</th>
                    <th className="p-2 whitespace-nowrap bg-muted/30">Jorn</th>
                  </>
                )}
                {colunas.map((c, i) => (
                  <th
                    key={c.field}
                    className={`p-2 whitespace-nowrap ${i === firstExtraIdx ? "border-l-2 border-dashed border-muted-foreground/30" : ""}`}
                    title={c.extra ? "Campo adicional SMS (fora do modelo oficial)" : undefined}
                  >
                    {c.label}
                    {c.extra && <span className="ml-1 text-[10px] text-muted-foreground">SMS</span>}
                  </th>
                ))}
                <th className="p-2">Análise</th>
                <th className="p-2 text-center">Anexos</th>
                <th className="p-2 text-center">Pend.</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, idx) => {
                const p = profMap.get(l.profissional_id);
                return (
                  <tr key={l.id ?? `new-${idx}`} className="border-b last:border-0">
                    <td className="p-2">
                      <div className="font-medium">
                        {p?.nome_completo ?? "Profissional indisponível"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Mat. {p?.matricula ?? "—"}
                        {p?.vinculos?.nome ? ` · ${p.vinculos.nome}` : ""}
                      </div>
                    </td>
                    {isEfetivo && (
                      <>
                        <td className="p-2 bg-muted/20 text-right font-mono text-xs">{fmtRef(p?.proj)}</td>
                        <td className="p-2 bg-muted/20 text-right font-mono text-xs">{fmtRef(p?.h_p)}</td>
                        <td className="p-2 bg-muted/20 text-right font-mono text-xs">{fmtRef(p?.c_h)}</td>
                        <td className="p-2 bg-muted/20 text-right font-mono text-xs">{fmtRef(p?.jorn)}</td>
                      </>
                    )}
                    {colunas.map((c, cIdx) => (
                      <td
                        key={c.field}
                        className={`p-1 ${cIdx === firstExtraIdx ? "border-l-2 border-dashed border-muted-foreground/30" : ""}`}
                      >
                        <Input
                          type="number"
                          step="0.01"
                          className="h-8 w-20"
                          disabled={!editable || !canEditar || l.status_linha !== "pendente"}
                          value={l[c.field]}
                          ref={(el) => { inputsRef.current[idx] ??= []; inputsRef.current[idx][cIdx] = el; }}
                          onKeyDown={(e) => handleCellKeyDown(e, idx, cIdx)}
                          onPaste={(e) => handleCellPaste(e, idx, cIdx)}
                          onChange={(e) => updateLinha(idx, { [c.field]: Number(e.target.value) } as Partial<Linha>)}
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <Badge variant={STATUS_LINHA_VARIANT[l.status_linha]}>
                        {STATUS_LINHA_LABEL[l.status_linha]}
                      </Badge>
                      {l.observacao_analise && (
                        <div className="mt-1 max-w-[180px] truncate text-xs text-muted-foreground" title={l.observacao_analise}>
                          {l.observacao_analise}
                        </div>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!l.id}
                        title={l.id ? "Gerenciar anexos" : "Salve a linha antes de anexar"}
                        onClick={() => setAnexosOpenFor(l)}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </td>
                    <td className="p-2 text-center">
                      {(() => {
                        const n = l.id ? pendCounts?.get(l.id) ?? 0 : 0;
                        if (canGerenciarPend) {
                          return (
                            <Button
                              size="icon"
                              variant={n > 0 ? "destructive" : "ghost"}
                              disabled={!l.id}
                              title={l.id ? (n > 0 ? `${n} pendência(s) — abrir nova` : "Abrir pendência para esta linha") : "Salve a linha antes de abrir pendência"}
                              onClick={() => { setPendFor(l); setPendTitulo(""); setPendDesc(""); }}
                            >
                              {n > 0 ? <AlertCircle className="h-4 w-4" /> : <Flag className="h-4 w-4" />}
                            </Button>
                          );
                        }
                        return n > 0 ? <Badge variant="destructive">{n}</Badge> : <span className="text-xs text-muted-foreground">—</span>;
                      })()}
                    </td>
                    <td className="p-2 text-right">
                      {editable && canEditar && l.status_linha === "pendente" && (
                        <Button size="icon" variant="ghost" onClick={() => removeLinha(idx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editable && canEditar && naoAdicionados.length > 0 && (
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-sm font-medium">Adicionar profissional</div>
          <div className="flex flex-wrap gap-2">
            {naoAdicionados.map((p) => (
              <Button key={p.id} size="sm" variant="outline" onClick={() => addProfissional(p.id)}>
                <Plus className="mr-1 h-3 w-3" />{p.nome_completo}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-3">
        <label className="mb-2 block text-sm font-medium">Observações</label>
        <Textarea
          rows={3}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          disabled={!editable || !canEditar}
        />
      </div>

      <AnexosDialog
        linha={anexosOpenFor}
        onClose={() => setAnexosOpenFor(null)}
        canEdit={!!editable && !!canEditar && anexosOpenFor?.status_linha === "pendente"}
        unidadeId={unidadeId}
        profNome={anexosOpenFor ? profMap.get(anexosOpenFor.profissional_id)?.nome_completo ?? "" : ""}
        userId={me?.id}
      />
      <Dialog open={!!copiarDialog} onOpenChange={(o) => !o && setCopiarDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar competência anterior</DialogTitle>
            <DialogDescription>
              Serão copiados os valores de <strong>{copiarDialog?.prevLabel}</strong> para as linhas ainda zeradas
              desta folha ({copiarDialog?.prevRows.length ?? 0} profissional(is) na competência anterior).
              Linhas já com valores não serão sobrescritas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopiarDialog(null)}>Cancelar</Button>
            <Button onClick={confirmarCopiar}>Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendFor} onOpenChange={(o) => { if (!o) { setPendFor(null); setPendTitulo(""); setPendDesc(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir pendência da linha</DialogTitle>
            <DialogDescription>
              {pendFor ? (profMap.get(pendFor.profissional_id)?.nome_completo ?? "Profissional") : ""}
              {pendFor?.id ? "" : " · salve a planilha antes"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Título</label>
              <Input value={pendTitulo} onChange={(e) => setPendTitulo(e.target.value)} placeholder="Ex.: Faltas divergentes do ponto" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <Textarea rows={4} value={pendDesc} onChange={(e) => setPendDesc(e.target.value)} placeholder="Detalhe o que a unidade deve corrigir..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendFor(null)}>Cancelar</Button>
            <Button onClick={() => abrirPendMutation.mutate()} disabled={abrirPendMutation.isPending}>Abrir pendência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Anexos por linha ----------------

type Categoria = { id: string; nome: string };

type DocRow = {
  id: string;
  nome: string;
  storage_path: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  categoria_id: string | null;
  created_at: string;
};

function AnexosDialog({
  linha,
  onClose,
  canEdit,
  unidadeId,
  profNome,
  userId,
}: {
  linha: Linha | null;
  onClose: () => void;
  canEdit: boolean;
  unidadeId?: string;
  profNome: string;
  userId?: string;
}) {
  const qc = useQueryClient();
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const linhaId = linha?.id;

  const { data: categorias } = useQuery({
    queryKey: ["doc-categorias"],
    queryFn: async (): Promise<Categoria[]> => {
      const { data, error } = await supabase
        .from("documento_categorias")
        .select("id, nome")
        .eq("ativa", true)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: anexos, refetch } = useQuery({
    queryKey: ["anexos-linha", linhaId],
    enabled: !!linhaId,
    queryFn: async (): Promise<DocRow[]> => {
      const { data, error } = await supabase
        .from("documentos")
        .select("id, nome, storage_path, mime_type, tamanho_bytes, categoria_id, created_at")
        .eq("tipo_entidade", "frequencia")
        .eq("metadata->>frequencia_profissional_id", linhaId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const registrarAnexoFn = useServerFn(registrarAnexoLinha);

  const handleUpload = async (file: File) => {
    if (!linhaId) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `frequencia_profissional/${linhaId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      await registrarAnexoFn({
        data: {
          frequencia_profissional_id: linhaId,
          unidade_id: unidadeId ?? null,
          categoria_id: categoriaId || null,
          nome: file.name,
          storage_path: path,
          mime_type: file.type || null,
          tamanho_bytes: file.size,
        },
      });
      toast.success("Anexo enviado");
      refetch();
      qc.invalidateQueries({ queryKey: ["anexos-linha", linhaId] });
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removerAnexo = async (doc: DocRow) => {
    try {
      await supabase.storage.from("documentos").remove([doc.storage_path]);
      const { error } = await supabase
        .from("documentos")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
        .eq("id", doc.id);
      if (error) throw error;
      toast.success("Anexo removido");
      refetch();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const baixar = async (doc: DocRow) => {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(doc.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open={!!linha} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anexos — {profNome}</DialogTitle>
        </DialogHeader>
        {canEdit && (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">Categoria</label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(categorias ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Arquivo</label>
                <Input
                  ref={fileRef}
                  type="file"
                  className="h-8"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                  disabled={uploading}
                />
              </div>
            </div>
            {uploading && <div className="text-xs text-muted-foreground"><Upload className="mr-1 inline h-3 w-3" />Enviando...</div>}
          </div>
        )}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {!anexos?.length ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum anexo.</div>
          ) : anexos.map((a) => {
            const cat = categorias?.find((c) => c.id === a.categoria_id);
            return (
              <div key={a.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <button className="flex-1 truncate text-left hover:underline" onClick={() => baixar(a)}>
                  {a.nome}
                </button>
                <div className="ml-2 flex items-center gap-2">
                  {cat && <Badge variant="outline" className="text-xs">{cat.nome}</Badge>}
                  {canEdit && (
                    <Button size="icon" variant="ghost" onClick={() => removerAnexo(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
