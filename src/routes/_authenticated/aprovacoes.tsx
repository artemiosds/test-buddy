import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { alterarStatusFrequencia } from "@/lib/frequencias.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared";
import { statusLabel } from "@/lib/status";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Eye, History, ListChecks, ScanSearch, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { useMunicipioParametros } from "@/hooks/use-municipio-parametros";
import type { Database } from "@/integrations/supabase/types";

type StatusFreq = Database["public"]["Enums"]["status_frequencia"];

const FILTROS: { value: "pendentes" | StatusFreq | "todas"; label: string }[] = [
  { value: "pendentes", label: "Pendentes (enviada + em análise)" },
  { value: "enviada", label: "Enviadas" },
  { value: "em_analise", label: "Em análise" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "rejeitada", label: "Rejeitadas" },
  { value: "com_pendencias", label: "Com pendências" },
  { value: "todas", label: "Todas" },
];

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  component: AprovacoesGuard,
});

function AprovacoesGuard() {
  const { has, isLoading } = usePermissions();
  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando permissões...</div>;
  }
  if (!has("frequencia.aprovar")) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-lg border bg-card p-6 text-center">
        <h1 className="text-lg font-semibold">Acesso negado</h1>
        <p className="text-sm text-muted-foreground">
          Você não possui permissão para acessar o módulo de Aprovações Institucionais.
          Este fluxo é restrito a Gestores e Master.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link to="/">Voltar ao Dashboard</Link>
        </Button>
      </div>
    );
  }
  return <AprovacoesPage />;
}

type AcaoTipo = "em_analise" | "aprovar" | "rejeitar" | "retornar";

const ACAO_LABEL: Record<AcaoTipo, string> = {
  em_analise: "Colocar em análise",
  aprovar: "Aprovar",
  rejeitar: "Rejeitar",
  retornar: "Retornar com pendências",
};

const ACAO_STATUS: Record<AcaoTipo, StatusFreq> = {
  em_analise: "em_analise",
  aprovar: "aprovada",
  rejeitar: "rejeitada",
  retornar: "com_pendencias",
};

function AprovacoesPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendentes" | StatusFreq | "todas">("pendentes");
  const [acao, setAcao] = useState<{ freqId: string; tipo: AcaoTipo } | null>(null);
  const [obs, setObs] = useState("");
  const [trilhaFreqId, setTrilhaFreqId] = useState<string | null>(null);
  const [linhasFreqId, setLinhasFreqId] = useState<string | null>(null);

  const canAnalisar = has("frequencia.analisar");
  const canAprovar = has("frequencia.aprovar");
  const canRejeitar = has("frequencia.rejeitar");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["aprovacoes-list", filtro],
    queryFn: async () => {
      let q = supabase
        .from("frequencias")
        .select(`
          id, tipo, status, data_envio, data_aprovacao, total_profissionais,
          competencia_unidades:competencia_unidade_id(
            unidades:unidade_id(id, nome),
            competencias:competencia_id(ano, mes)
          )
        `)
        .is("deleted_at", null)
        .order("data_envio", { ascending: false, nullsFirst: false })
        .limit(200);

      if (filtro === "pendentes") q = q.in("status", ["enviada", "em_analise"]);
      else if (filtro !== "todas") q = q.eq("status", filtro as StatusFreq);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const alterarStatusFn = useServerFn(alterarStatusFrequencia);

  const registraMutation = useMutation({
    mutationFn: async ({ freqId, tipo, observacoes }: {
      freqId: string; tipo: AcaoTipo; observacoes: string; statusAnterior: StatusFreq;
    }) => {
      const statusNovo = ACAO_STATUS[tipo];
      await alterarStatusFn({
        data: {
          frequencia_id: freqId,
          status: statusNovo,
          observacoes: observacoes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Ação registrada");
      setAcao(null);
      setObs("");
      qc.invalidateQueries({ queryKey: ["aprovacoes-list"] });
      qc.invalidateQueries({ queryKey: ["frequencia"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirAcao(freqId: string, tipo: AcaoTipo) {
    setAcao({ freqId, tipo });
    setObs("");
  }

  const acaoAtual = acao
    ? rows?.find((r) => r.id === acao.freqId) ?? null
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Aprovações institucionais</h1>
          <p className="text-sm text-muted-foreground">
            Fluxo formal de análise, aprovação e rejeição das frequências enviadas pelas unidades.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FILTROS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !rows?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma frequência para este filtro.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Unidade</th>
                <th className="p-3">Competência</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Prof.</th>
                <th className="p-3">Status</th>
                <th className="p-3">Enviada em</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cu = r.competencia_unidades;
                const comp = cu?.competencias;
                const pendente = r.status === "enviada" || r.status === "em_analise";
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">{cu?.unidades?.nome ?? "—"}</td>
                    <td className="p-3">{comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "—"}</td>
                    <td className="p-3 capitalize">{r.tipo}</td>
                    <td className="p-3">{r.total_profissionais ?? 0}</td>
                    <td className="p-3">
                      <StatusBadge domain="frequencia" value={r.status} />
                    </td>
                    <td className="p-3">{r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link to="/frequencias/$id" params={{ id: r.id }}>
                            <Eye className="mr-1 h-4 w-4" />Abrir
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setTrilhaFreqId(r.id)}>
                          <History className="mr-1 h-4 w-4" />Trilha
                        </Button>
                        {(canAprovar || canRejeitar) && (
                          <Button size="sm" variant="outline" onClick={() => setLinhasFreqId(r.id)}>
                            <ListChecks className="mr-1 h-4 w-4" />Linhas
                          </Button>
                        )}
                        {pendente && canAnalisar && r.status === "enviada" && (
                          <Button size="sm" variant="outline" onClick={() => abrirAcao(r.id, "em_analise")}>
                            <ScanSearch className="mr-1 h-4 w-4" />Analisar
                          </Button>
                        )}
                        {pendente && canAprovar && (
                          <Button size="sm" onClick={() => abrirAcao(r.id, "aprovar")}>
                            <CheckCircle2 className="mr-1 h-4 w-4" />Aprovar
                          </Button>
                        )}
                        {pendente && canRejeitar && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => abrirAcao(r.id, "retornar")}>
                              <ClipboardList className="mr-1 h-4 w-4" />Retornar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => abrirAcao(r.id, "rejeitar")}>
                              <XCircle className="mr-1 h-4 w-4" />Rejeitar
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!acao} onOpenChange={(o) => { if (!o) { setAcao(null); setObs(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acao ? ACAO_LABEL[acao.tipo] : ""}</DialogTitle>
            <DialogDescription>
              {acaoAtual?.competencia_unidades?.unidades?.nome} · {" "}
              {acaoAtual?.competencia_unidades?.competencias
                ? `${String(acaoAtual.competencia_unidades.competencias.mes).padStart(2, "0")}/${acaoAtual.competencia_unidades.competencias.ano}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Observações {acao?.tipo === "retornar" || acao?.tipo === "rejeitar" ? "(obrigatório)" : "(opcional)"}</label>
            <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Justifique a decisão / oriente a unidade..." />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAcao(null); setObs(""); }}>Cancelar</Button>
            <Button
              disabled={registraMutation.isPending || ((acao?.tipo === "retornar" || acao?.tipo === "rejeitar") && !obs.trim())}
              onClick={() => {
                if (!acao || !acaoAtual) return;
                registraMutation.mutate({
                  freqId: acao.freqId,
                  tipo: acao.tipo,
                  observacoes: obs.trim(),
                  statusAnterior: acaoAtual.status,
                });
              }}
            >Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrilhaDialog freqId={trilhaFreqId} onClose={() => setTrilhaFreqId(null)} />
      <LinhasAnaliseDialog
        freqId={linhasFreqId}
        onClose={() => setLinhasFreqId(null)}
        meId={me?.id}
        canAprovar={canAprovar}
        canRejeitar={canRejeitar}
        isMaster={!!me?.is_master}
      />
    </div>
  );
}

function TrilhaDialog({ freqId, onClose }: { freqId: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["frequencia-aprovacoes", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_aprovacoes")
        .select("id, acao, status_anterior, status_novo, observacoes, created_at, executado_por, usuarios:executado_por(nome_completo)")
        .eq("frequencia_id", freqId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={!!freqId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trilha de aprovações</DialogTitle>
          <DialogDescription>Histórico completo de decisões desta frequência.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : !data?.length ? (
          <div className="p-4 text-sm text-muted-foreground">Nenhum registro ainda.</div>
        ) : (
          <ol className="space-y-3">
            {data.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium">{r.acao}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {r.status_anterior ? statusLabel("frequencia", r.status_anterior) : "—"} → {statusLabel("frequencia", r.status_novo)}
                  {r.usuarios?.nome_completo ? ` · por ${r.usuarios.nome_completo}` : ""}
                </div>
                {r.observacoes && (
                  <div className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-2 text-sm">{r.observacoes}</div>
                )}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

type LinhaAnalise = {
  id: string;
  profissional_id: string;
  status_linha: Database["public"]["Enums"]["status_linha_frequencia"];
  observacao_analise: string | null;
  analisado_em: string | null;
  he_50: number | null;
  he_100: number | null;
  plantoes_extras: number | null;
  profissionais: { nome_completo: string; matricula: string | null } | null;
  analisado_por_usuario: { nome_completo: string } | null;
};

const STATUS_LINHA_LABEL: Record<LinhaAnalise["status_linha"], string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};
const STATUS_LINHA_VARIANT: Record<LinhaAnalise["status_linha"], "outline" | "secondary" | "destructive"> = {
  pendente: "outline",
  aprovada: "secondary",
  rejeitada: "destructive",
};

function LinhasAnaliseDialog({
  freqId, onClose, meId, canAprovar, canRejeitar, isMaster,
}: {
  freqId: string | null;
  onClose: () => void;
  meId: string | undefined;
  canAprovar: boolean;
  canRejeitar: boolean;
  isMaster: boolean;
}) {
  const qc = useQueryClient();
  const [obsMap, setObsMap] = useState<Record<string, string>>({});
  const [soExcecoes, setSoExcecoes] = useState(false);
  const { data: parametros } = useMunicipioParametros();

  const { data: linhas, isLoading } = useQuery({
    queryKey: ["frequencia-linhas-analise", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select("id, profissional_id, status_linha, observacao_analise, analisado_em, he_50, he_100, plantoes_extras, profissionais:profissional_id(nome_completo, matricula), analisado_por_usuario:analisado_por(nome_completo)")
        .eq("frequencia_id", freqId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as (LinhaAnalise & { profissional_id: string })[];
    },
  });

  // Busca a competência (ano/mes) desta frequência para calcular a anterior.
  const { data: compAtual } = useQuery({
    queryKey: ["frequencia-competencia", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select("competencia_unidades:competencia_unidade_id(competencias:competencia_id(id, ano, mes))")
        .eq("id", freqId!)
        .maybeSingle();
      if (error) throw error;
      const c = data?.competencia_unidades?.competencias;
      return c ? { id: c.id, ano: c.ano, mes: c.mes } : null;
    },
  });

  // Busca soma HE (50+100) por profissional na competência anterior.
  const { data: prevHeMap } = useQuery({
    queryKey: ["freq-he-prev", compAtual?.ano, compAtual?.mes],
    enabled: !!compAtual && !!linhas?.length,
    queryFn: async () => {
      const prevAno = compAtual!.mes === 1 ? compAtual!.ano - 1 : compAtual!.ano;
      const prevMes = compAtual!.mes === 1 ? 12 : compAtual!.mes - 1;
      const { data: compPrev, error: cErr } = await supabase
        .from("competencias")
        .select("id")
        .eq("ano", prevAno)
        .eq("mes", prevMes)
        .is("deleted_at", null)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!compPrev) return new Map<string, number>();

      const profIds = Array.from(new Set((linhas ?? []).map((l) => l.profissional_id).filter(Boolean)));
      if (!profIds.length) return new Map<string, number>();

      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select("profissional_id, he_50, he_100, frequencias!inner(competencia_unidades!inner(competencia_id))")
        .in("profissional_id", profIds)
        .eq("frequencias.competencia_unidades.competencia_id", compPrev.id)
        .is("deleted_at", null);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as unknown as { profissional_id: string; he_50: number | null; he_100: number | null }[]) {
        const total = Number(r.he_50 ?? 0) + Number(r.he_100 ?? 0);
        map.set(r.profissional_id, (map.get(r.profissional_id) ?? 0) + total);
      }
      return map;
    },
  });

  const mut = useMutation({
    mutationFn: async ({ id, status, obs }: { id: string; status: "aprovada" | "rejeitada"; obs: string }) => {
      if (status === "rejeitada" && !obs.trim()) {
        throw new Error("Informe a observação para rejeitar a linha.");
      }
      const { error } = await supabase
        .from("frequencia_profissional")
        .update({
          status_linha: status,
          observacao_analise: obs.trim() || null,
          analisado_por: meId,
          analisado_em: new Date().toISOString(),
          updated_by: meId,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Linha atualizada");
      qc.invalidateQueries({ queryKey: ["frequencia-linhas-analise", freqId] });
      qc.invalidateQueries({ queryKey: ["frequencia-profissional", freqId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const excedeLimite = (l: LinhaAnalise) => {
    const l50 = parametros?.limite_he_50;
    const l100 = parametros?.limite_he_100;
    const lp = parametros?.limite_plantoes;
    return (
      (l50 != null && Number(l.he_50 ?? 0) > l50) ||
      (l100 != null && Number(l.he_100 ?? 0) > l100) ||
      (lp != null && Number(l.plantoes_extras ?? 0) > lp)
    );
  };

  // Variação HE >= +50% vs mês anterior. Retorna { variou, pct, prev }.
  const variacaoHe = (l: LinhaAnalise & { profissional_id: string }) => {
    const prev = prevHeMap?.get(l.profissional_id);
    if (prev == null || prev <= 0) return { variou: false, pct: 0, prev: null as number | null };
    const atual = Number(l.he_50 ?? 0) + Number(l.he_100 ?? 0);
    const pct = ((atual - prev) / prev) * 100;
    return { variou: pct >= 50, pct, prev };
  };

  const motivosExcecao = (l: LinhaAnalise & { profissional_id: string }) => {
    const motivos: string[] = [];
    if (excedeLimite(l)) motivos.push("limite fixo");
    const v = variacaoHe(l);
    if (v.variou) motivos.push(`+${v.pct.toFixed(0)}% vs mês anterior`);
    return motivos;
  };

  const isExcecao = (l: LinhaAnalise & { profissional_id: string }) => motivosExcecao(l).length > 0;

  const linhasArr = (linhas ?? []) as (LinhaAnalise & { profissional_id: string })[];
  const totalExcecoes = linhasArr.filter(isExcecao).length;
  const linhasVisiveis = linhasArr.filter((l) => !soExcecoes || isExcecao(l));

  return (
    <Dialog open={!!freqId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Análise por profissional</DialogTitle>
          <DialogDescription>
            Aprove ou rejeite cada linha individualmente. O responsável e a data são preenchidos automaticamente.
          </DialogDescription>
        </DialogHeader>
        {(parametros?.limite_he_50 != null || parametros?.limite_he_100 != null || parametros?.limite_plantoes != null) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-xs">
            <div>
              Alçada configurada:
              {parametros?.limite_he_50 != null && <> HE 50% ≤ {parametros.limite_he_50}</>}
              {parametros?.limite_he_100 != null && <> · HE 100% ≤ {parametros.limite_he_100}</>}
              {parametros?.limite_plantoes != null && <> · Plantões ≤ {parametros.limite_plantoes}</>}
              {" · "}
              <strong>{totalExcecoes}</strong> exceção(ões)
              {!isMaster && totalExcecoes > 0 && <span className="ml-1 text-destructive">— aprovação restrita ao MASTER</span>}
            </div>
            <Button size="sm" variant={soExcecoes ? "default" : "outline"} onClick={() => setSoExcecoes((v) => !v)}>
              {soExcecoes ? "Mostrar todas" : "Só exceções"}
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : !linhasVisiveis.length ? (
          <div className="p-4 text-sm text-muted-foreground">Nenhuma linha para exibir.</div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b bg-muted/60">
                <tr className="text-left">
                  <th className="p-2">Profissional</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">HE50 · HE100 · Plant.</th>
                  <th className="p-2">Observação</th>
                  <th className="p-2 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {linhasVisiveis.map((l) => {
                   const excede = excedeLimite(l);
                   const motivos = motivosExcecao(l);
                   const excecao = motivos.length > 0;
                   // Bloqueio permanece só quando ultrapassa limite fixo (variação é apenas sinal).
                   const bloqueado = excede && !isMaster;
                   return (
                   <tr key={l.id} className={`border-b last:border-0 align-top ${excecao ? "bg-destructive/5" : ""}`}>
                     <td className="p-2">
                       <div className="font-medium">{l.profissionais?.nome_completo ?? "—"}</div>
                       <div className="text-xs text-muted-foreground">
                         Mat. {l.profissionais?.matricula ?? "—"}
                         {l.analisado_em && (
                           <> · analisado {new Date(l.analisado_em).toLocaleString("pt-BR")}
                             {l.analisado_por_usuario?.nome_completo ? ` por ${l.analisado_por_usuario.nome_completo}` : ""}
                           </>
                         )}
                       </div>
                     </td>
                     <td className="p-2">
                       <Badge variant={STATUS_LINHA_VARIANT[l.status_linha]}>
                         {STATUS_LINHA_LABEL[l.status_linha]}
                       </Badge>
                       {excecao && (
                         <div className="mt-1 text-[10px] font-semibold uppercase text-destructive" title={motivos.join(" · ")}>
                           Exceção: {motivos.join(" · ")}
                         </div>
                       )}
                     </td>
                    <td className="p-2 text-xs whitespace-nowrap">
                      {Number(l.he_50 ?? 0)} · {Number(l.he_100 ?? 0)} · {Number(l.plantoes_extras ?? 0)}
                    </td>
                    <td className="p-2">
                      <Input
                        placeholder="Observação (obrigatória p/ rejeitar)"
                        defaultValue={l.observacao_analise ?? ""}
                        onChange={(e) => setObsMap((m) => ({ ...m, [l.id]: e.target.value }))}
                        className="h-8"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex justify-end gap-1">
                        {canAprovar && (
                          <Button
                            size="sm"
                            variant={l.status_linha === "aprovada" ? "secondary" : "default"}
                            disabled={mut.isPending || bloqueado}
                            title={bloqueado ? "Linha em exceção: só MASTER aprova." : undefined}
                            onClick={() => mut.mutate({
                              id: l.id,
                              status: "aprovada",
                              obs: obsMap[l.id] ?? l.observacao_analise ?? "",
                            })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        {canRejeitar && (
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={mut.isPending}
                            onClick={() => mut.mutate({
                              id: l.id,
                              status: "rejeitada",
                              obs: obsMap[l.id] ?? l.observacao_analise ?? "",
                            })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
