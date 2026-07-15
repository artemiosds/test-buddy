import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarFolhaEfetivos,
  salvarFolhaEfetivos,
  enviarFolhaEfetivos,
} from "@/lib/frequencias-efetivos.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Save, Send, Search, FileSpreadsheet } from "lucide-react";
import { useCurrentUser, usePermissions } from "@/hooks/use-permissions";
import { useCompetenciaAtiva } from "@/hooks/use-competencia-ativa";
import type { Database } from "@/integrations/supabase/types";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const STATUS_LABEL: Record<StatusFreq, string> = {
  rascunho: "Rascunho", enviada: "Enviada", em_analise: "Em análise",
  com_pendencias: "Devolvida", aprovada: "Aprovada",
  rejeitada: "Rejeitada", arquivada: "Arquivada",
};

const STATUS_VARIANT: Record<StatusFreq, "default"|"secondary"|"outline"|"destructive"> = {
  rascunho: "outline", enviada: "default", em_analise: "secondary",
  com_pendencias: "destructive", aprovada: "default",
  rejeitada: "destructive", arquivada: "outline",
};

type LinhaState = {
  profissional_id: string;
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

  if (!has("frequencia.visualizar")) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Acesso negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para visualizar frequências.</p>
      </div>
    );
  }

  const totalCols = 6 /* ref */ + CAMPOS_OFICIAIS.length + 1 /* divisor */ + CAMPOS_SMS.length + 1 /* obs */ + 1 /* status */;

  return (
    <div className="p-4 md:p-6 space-y-4">
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
          <Badge variant={STATUS_VARIANT[folhaStatus]}>{STATUS_LABEL[folhaStatus]}</Badge>
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
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-[220px_1fr_260px] items-end">
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
      </div>

      {compFechada && (
        <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-sm px-3 py-2">
          Competência encerrada — folha em modo somente leitura.
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-2 whitespace-nowrap" rowSpan={2}>Matrícula</th>
              <th className="text-left px-2 py-2 min-w-[180px]" rowSpan={2}>Nome</th>
              <th className="text-right px-2 py-2" rowSpan={2}>Proj</th>
              <th className="text-right px-2 py-2" rowSpan={2}>H.P</th>
              <th className="text-right px-2 py-2" rowSpan={2}>C.H</th>
              <th className="text-right px-2 py-2" rowSpan={2}>Jorn</th>
              <th
                className="text-center px-2 py-1 border-l bg-primary/5"
                colSpan={CAMPOS_OFICIAIS.length}
              >
                Modelo oficial — Prefeitura
              </th>
              <th
                className="text-center px-2 py-1 border-l bg-amber-50 text-amber-900"
                colSpan={CAMPOS_SMS.length}
              >
                Campos adicionais SMS
              </th>
              <th className="text-left px-2 py-2 min-w-[160px] border-l" rowSpan={2}>Obs.</th>
              <th className="text-center px-2 py-2" rowSpan={2}>Status</th>
            </tr>
            <tr>
              {CAMPOS_OFICIAIS.map((c, i) => (
                <th
                  key={c.key}
                  className={`text-right px-2 py-1 whitespace-nowrap bg-primary/5 ${i === 0 ? "border-l" : ""}`}
                >
                  {c.label}
                </th>
              ))}
              {CAMPOS_SMS.map((c, i) => (
                <th
                  key={c.key}
                  className={`text-right px-2 py-1 whitespace-nowrap bg-amber-50 text-amber-900 ${i === 0 ? "border-l" : ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isFetching && (
              <tr><td colSpan={totalCols} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isFetching && filtradas.length === 0 && (
              <tr><td colSpan={totalCols} className="px-3 py-6 text-center text-muted-foreground">
                Nenhum servidor efetivo nesta unidade.
              </td></tr>
            )}
            {filtradas.map((it: any) => {
              const p = it.profissional;
              const l = linhas[p.id];
              const linhaAprovada = (it.linha as any)?.status_linha === "aprovada";
              const ro = !canEdit || linhaAprovada;
              return (
                <tr key={p.id} className="border-t align-top hover:bg-muted/20">
                  <td className="px-2 py-1.5 font-mono text-xs">{p.matricula ?? "-"}</td>
                  <td className="px-2 py-1.5">{p.nome}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.proj ?? "-"}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.h_p ?? "-"}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.c_h ?? "-"}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">{p.jorn ?? "-"}</td>
                  {CAMPOS_OFICIAIS.map((c, i) => (
                    <td key={c.key} className={`px-1 py-1 bg-primary/5 ${i === 0 ? "border-l" : ""}`}>
                      <Input
                        type="number" min={0} step={c.key === "incentivo" ? "0.01" : "1"}
                        value={l?.[c.key as keyof LinhaState] as number ?? 0}
                        onChange={(e) => updateCampo(p.id, c.key as keyof LinhaState, e.target.value)}
                        disabled={ro}
                        className="h-8 text-right w-20"
                      />
                    </td>
                  ))}
                  {CAMPOS_SMS.map((c, i) => (
                    <td key={c.key} className={`px-1 py-1 bg-amber-50/60 ${i === 0 ? "border-l" : ""}`}>
                      <Input
                        type="number" min={0} step="1"
                        value={l?.[c.key as keyof LinhaState] as number ?? 0}
                        onChange={(e) => updateCampo(p.id, c.key as keyof LinhaState, e.target.value)}
                        disabled={ro}
                        className="h-8 text-right w-20"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1 border-l">
                    <Textarea
                      value={l?.observacoes ?? ""}
                      onChange={(e) => updateCampo(p.id, "observacoes", e.target.value)}
                      disabled={ro}
                      rows={1}
                      className="min-h-8 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Badge variant="outline">
                      {(it.linha as any)?.status_linha ?? "pendente"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Proj</strong>, <strong>H.P</strong>, <strong>C.H</strong> e <strong>Jorn</strong> são somente leitura —
        vêm do cadastro do profissional. Os campos em amarelo (<em>Férias indicativo</em>, <em>Licença-Prêmio</em>)
        são controles internos da SMS e não fazem parte do modelo oficial da Prefeitura.
      </p>
    </div>
  );
}