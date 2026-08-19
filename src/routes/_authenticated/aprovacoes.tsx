import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";
import { UploadAnexoModal } from "@/components/aprovacoes/UploadAnexoModal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRetryMutation } from "@/lib/retry-mutation";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { alterarStatusFrequencia } from "@/lib/frequencias.functions";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, StatusBadge } from "@/components/shared";
import { salvarFolhaEfetivos } from "@/lib/frequencias-efetivos.functions";
import { salvarFolhaContratados } from "@/lib/frequencias-contratados.functions";
import { statusLabel } from "@/lib/status";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  History,
  ListChecks,
  Paperclip,
  ScanSearch,
  Upload,
  XCircle,
} from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/aprovacoes")({ errorComponent: ErrorComponent,
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
          Você não possui permissão para acessar o módulo de Aprovações Institucionais. Este fluxo é
          restrito a Gestores e Master.
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
  retornar: "devolvida" as StatusFreq,
};

function AprovacoesPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<"pendentes" | StatusFreq | "todas">("pendentes");
  const [acao, setAcao] = useState<{ freqId: string; tipo: AcaoTipo } | null>(null);
  const [obs, setObs] = useState("");
  const [trilhaFreqId, setTrilhaFreqId] = useState<string | null>(null);
  const [trilhaAberta, setTrilhaAbertura] = useState(false);
  const [linhasFreqId, setLinhasFreqId] = useState<string | null>(null);
  const [modalAnexo, setModalAnexo] = useState<{
    id: string;
    subtipo: string;
    unidadeId: string;
    setorId?: string | null;
  } | null>(null);

  const canAnalisar = has("frequencia.analisar");
  const canAprovar = has("frequencia.aprovar");
  const canRejeitar = has("frequencia.rejeitar");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["aprovacoes-list", filtro],
    queryFn: async () => {
      let q = supabase
        .from("frequencias")
        .select(
          `
          id, tipo, status, data_envio, data_aprovacao, total_profissionais,
          competencia_unidade_id, setor_id,
          competencia_unidades:competencia_unidade_id(
            unidade_id,
            competencia_id,
            unidades:unidade_id(id, nome),
            competencias:competencia_id(ano, mes)
          ),
          setores:setor_id(id, nome)
        `,
        )
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

  // Idempotente: alterar_status apenas move a frequência para um estado alvo.
  const registraMutation = useRetryMutation({
    retry: { operation: "frequencia.alterar_status" },
    mutationFn: async ({
      freqId,
      tipo,
      observacoes,
    }: {
      freqId: string;
      tipo: AcaoTipo;
      observacoes: string;
      statusAnterior: StatusFreq;
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

  const acaoAtual = acao ? (rows?.find((r) => r.id === acao.freqId) ?? null) : null;

  // Indicador de anexos: conta os documentos de justificativa por submissão
  // (competência + unidade) e vínculo, para sinalizar na listagem.
  const submissaoIds = (rows ?? [])
    .map((r) => r.competencia_unidade_id as string | null)
    .filter((v): v is string => !!v);

  const { data: anexosPorSubmissao } = useQuery({
    queryKey: ["aprovacoes-anexos", submissaoIds.join(","), rows?.map(r => r.setor_id).join(',')],
    enabled: submissaoIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("entidade_id, metadata")
        .eq("tipo_entidade", "frequencia_submissao")
        .in("entidade_id", [...new Set(submissaoIds)])
        .is("deleted_at", null);
      if (error) throw error;
      const mapa: Record<string, number> = {};
      for (const d of data ?? []) {
        const folha = (d.metadata as { folha?: string } | null)?.folha ?? "efetivos";
        const setorId = (d.metadata as { setor_id?: string } | null)?.setor_id;
        const chave = setorId ? `${d.entidade_id}:${folha}:${setorId}` : `${d.entidade_id}:${folha}`;
        mapa[chave] = (mapa[chave] ?? 0) + 1;
      }
      return mapa;
    },
  });

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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTROS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
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
                const subtipo = r.tipo === "contratados" ? "contratados" : "efetivos";
                const chaveAnexo = r.setor_id 
                  ? `${r.competencia_unidade_id}:${subtipo}:${r.setor_id}`
                  : `${r.competencia_unidade_id}:${subtipo}`;
                const qtdAnexos = anexosPorSubmissao?.[chaveAnexo] ?? 0;
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      <span className="flex flex-col">
                        <span className="font-medium text-foreground">{cu?.unidades?.nome ?? "—"}</span>
                        {(r as any).setores?.nome && (
                          <span className="text-[11px] font-normal text-muted-foreground bg-primary/5 border border-primary/10 px-1.5 py-0 rounded w-fit">
                            Setor: {(r as any).setores.nome}
                          </span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5 ml-2">
                        {qtdAnexos > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                            title={`${qtdAnexos} documento(s) de justificativa anexado(s)`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {qtdAnexos}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="p-3">
                      {comp ? `${String(comp.mes).padStart(2, "0")}/${comp.ano}` : "—"}
                    </td>
                    <td className="p-3 capitalize">{r.tipo}</td>
                    <td className="p-3">{r.total_profissionais ?? 0}</td>
                    <td className="p-3">
                      <StatusBadge domain="frequencia" value={r.status} />
                    </td>
                    <td className="p-3">
                      {r.data_envio ? new Date(r.data_envio).toLocaleString("pt-BR") : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {r.tipo === "contratados" ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to="/frequencia/contratados"
                              search={{
                                competenciaId: cu?.competencia_id,
                                unidadeId: cu?.unidade_id,
                              }}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Abrir
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="ghost">
                          <Link to="/frequencias/$id" params={{ id: r.id }}>
                            <Eye className="mr-1 h-4 w-4" />
                            Abrir
                          </Link>
                        </Button>
                      )}
                      <OfflineButton
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setModalAnexo({
                            id: r.competencia_unidade_id as string,
                            subtipo: r.tipo === "contratados" ? "contratados" : "efetivos",
                            unidadeId: cu?.unidade_id as string,
                            setorId: r.setor_id,
                          })
                        }
                      >
                        <Upload className="mr-1 h-4 w-4" />
                        Anexos
                      </OfflineButton>
                      <OfflineButton size="sm" variant="ghost" onClick={() => { setTrilhaFreqId(r.id); setTrilhaAbertura(true); }}>
                        <History className="mr-1 h-4 w-4" />
                        Trilha
                      </OfflineButton>
                        {(canAprovar || canRejeitar) && (
                          <OfflineButton size="sm" variant="outline" onClick={() => setLinhasFreqId(r.id)}>
                            <ListChecks className="mr-1 h-4 w-4" />
                            Linhas
                          </OfflineButton>
                        )}
                        {pendente && canAnalisar && r.status === "enviada" && (
                          <OfflineButton
                            size="sm"
                            variant="outline"
                            onClick={() => abrirAcao(r.id, "em_analise")}
                            requireOnline
                          >
                            <ScanSearch className="mr-1 h-4 w-4" />
                            Analisar
                          </OfflineButton>
                        )}
                        {pendente && canAprovar && (
                          <OfflineButton 
                            size="sm" 
                            onClick={() => abrirAcao(r.id, "aprovar")}
                            requireOnline
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Aprovar
                          </OfflineButton>
                        )}
                        {pendente && canRejeitar && (
                          <>
                            <OfflineButton
                              size="sm"
                              variant="outline"
                              onClick={() => abrirAcao(r.id, "retornar")}
                              requireOnline
                            >
                              <ClipboardList className="mr-1 h-4 w-4" />
                              Retornar
                            </OfflineButton>
                            <OfflineButton
                              size="sm"
                              variant="destructive"
                              onClick={() => abrirAcao(r.id, "rejeitar")}
                              requireOnline
                            >
                              <XCircle className="mr-1 h-4 w-4" />
                              Rejeitar
                            </OfflineButton>
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

      <Dialog
        open={!!acao}
        onOpenChange={(o) => {
          if (!o) {
            setAcao(null);
            setObs("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{acao ? ACAO_LABEL[acao.tipo] : ""}</DialogTitle>
            <DialogDescription>
              {acaoAtual?.competencia_unidades?.unidades?.nome} ·{" "}
              {acaoAtual?.competencia_unidades?.competencias
                ? `${String(acaoAtual.competencia_unidades.competencias.mes).padStart(2, "0")}/${acaoAtual.competencia_unidades.competencias.ano}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Observações{" "}
              {acao?.tipo === "retornar" || acao?.tipo === "rejeitar"
                ? "(obrigatório)"
                : "(opcional)"}
            </label>
            <Textarea
              rows={4}
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Justifique a decisão / oriente a unidade..."
            />
          </div>
          {acaoAtual?.competencia_unidade_id && (
            <div className="mt-3 border-t pt-3">
              <AnexosEntidade
                entidadeId={acaoAtual.competencia_unidade_id as string}
                tipoEntidade="frequencia_submissao"
                subtipo={acaoAtual.tipo === "contratados" ? "contratados" : "efetivos"}
                unidadeId={acaoAtual.competencia_unidades?.unidades?.id ?? null}
                canEdit={false}
                mostrarLixeira={false}
                titulo="Documentos de justificativa"
              />
            </div>
          )}
          <DialogFooter>
            <OfflineButton
              variant="ghost"
              onClick={() => {
                setAcao(null);
                setObs("");
              }}
            >
              Cancelar
            </OfflineButton>
            <OfflineButton
              requireOnline
              disabled={
                registraMutation.isPending ||
                ((acao?.tipo === "retornar" || acao?.tipo === "rejeitar") && !obs.trim())
              }
              onClick={() => {
                if (!acao || !acaoAtual) return;
                registraMutation.mutate({
                  freqId: acao.freqId,
                  tipo: acao.tipo,
                  observacoes: obs.trim(),
                  statusAnterior: acaoAtual.status,
                });
              }}
            >
              Confirmar
            </OfflineButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TrilhaDialog freqId={trilhaFreqId} open={trilhaAberta} onClose={() => { setTrilhaFreqId(null); setTrilhaAbertura(false); }} />
      
      {modalAnexo && (
        <UploadAnexoModal
          open={!!modalAnexo}
          onOpenChange={(o) => !o && setModalAnexo(null)}
          entidadeId={modalAnexo.id}
            subtipo={modalAnexo.subtipo}
            setorId={modalAnexo.setorId}
            unidadeId={modalAnexo.unidadeId}
        />
      )}

      <LinhasAnaliseDialog
        freqId={linhasFreqId}
        onClose={() => {
          setLinhasFreqId(null);
          qc.invalidateQueries({ queryKey: ["aprovacoes-list"] });
        }}
        meId={me?.id}
        canAprovar={canAprovar}
        canRejeitar={canRejeitar}
        isMaster={!!me?.is_master}
      />
    </div>
  );
}

function TrilhaDialog({ freqId, open, onClose }: { freqId: string | null; open: boolean; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["frequencia-aprovacoes", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data: hist, error: hErr } = await supabase
        .from("frequencia_historico")
        .select(
          "id, acao, status_anterior, status_novo, justificativa, created_at, executado_por, executado_nome, executado_perfil",
        )
        .eq("frequencia_id", freqId!)
        .order("created_at", { ascending: false });
      
      if (hErr) throw hErr;

      // Legado (opcional - compatibilidade se houver registros antigos)
      const { data: aprov, error: aErr } = await supabase
        .from("frequencia_aprovacoes")
        .select(
          "id, acao, status_anterior, status_novo, observacoes, created_at, executado_por, usuarios:executado_por(nome_completo)",
        )
        .eq("frequencia_id", freqId!)
        .order("created_at", { ascending: false });
      
      if (aErr) throw aErr;

      const results = [
        ...(hist ?? []).map(h => ({
          id: h.id,
          acao: h.acao,
          status_anterior: h.status_anterior,
          status_novo: h.status_novo,
          observacoes: h.justificativa,
          created_at: h.created_at,
          autor: h.executado_nome || "Usuário HSM",
          perfil: h.executado_perfil
        })),
        ...(aprov ?? []).map(a => ({
          id: a.id,
          acao: a.acao,
          status_anterior: a.status_anterior,
          status_novo: a.status_novo,
          observacoes: a.observacoes,
          created_at: a.created_at,
          autor: a.usuarios?.nome_completo || "Sistema",
          perfil: null
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return results;
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Trilha de auditoria</DialogTitle>
          <DialogDescription>Histórico de ações, perfis e justificativas.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : !data?.length ? (
          <div className="p-2">
            <EmptyState title="Nenhum registro ainda." />
          </div>
        ) : (
          <ol className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {data.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{r.acao}</div>
                  <div className="text-[11px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {new Date(r.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <StatusBadge domain="frequencia" value={r.status_anterior} className="h-4 text-[10px] px-1" />
                    <span>→</span>
                    <StatusBadge domain="frequencia" value={r.status_novo} className="h-4 text-[10px] px-1" />
                  </div>
                  <span className="opacity-40">|</span>
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    {r.autor} {r.perfil ? `(${r.perfil})` : ""}
                  </div>
                </div>
                {r.observacoes && (
                  <div className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-[13px] border border-slate-200 dark:border-slate-800 italic text-slate-600 dark:text-slate-400">
                    "{r.observacoes}"
                  </div>
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
const STATUS_LINHA_VARIANT: Record<
  LinhaAnalise["status_linha"],
  "outline" | "secondary" | "destructive"
> = {
  pendente: "outline",
  aprovada: "secondary",
  rejeitada: "destructive",
};

function LinhasAnaliseDialog({
  freqId,
  onClose,
  meId,
  canAprovar,
  canRejeitar,
  isMaster,
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
  const [editMap, setEditMap] = useState<Record<string, any>>({});
  const { data: parametros } = useMunicipioParametros();
  const salvarEfetivosFn = useServerFn(salvarFolhaEfetivos);
  const salvarContratadosFn = useServerFn(salvarFolhaContratados);

  const { data: freqBase } = useQuery({
    queryKey: ["frequencia-base", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select(`
          id, tipo, setor_id, 
          competencia_unidade_id, 
          competencia_unidades(unidade_id, competencia_id)
        `)
        .eq("id", freqId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: linhas, isLoading } = useQuery({
    queryKey: ["frequencia-linhas-analise", freqId, freqBase?.tipo, freqBase?.setor_id],
    enabled: !!freqId && !!freqBase,
    queryFn: async () => {
      if (freqBase?.tipo === "contratados") {
        const cu = freqBase.competencia_unidades as any;
        const { data, error } = await supabase
          .from("frequencias_contratados")
          .select(`
            id:profissional_id, profissional_id, status:status, observacoes, 
            dias_trabalhados, dias_falta, atestado, he_50, he_100, adn, 
            plantoes, sobreaviso, incentivo, 
            profissionais:profissional_id!inner(nome_completo, matricula, setor_id)
          `)
          .eq("competencia_id", cu.competencia_id)
          .eq("unidade_id", cu.unidade_id)
          .is("deleted_at", null);
        
        if (error) throw error;
        
        let rows = data ?? [];
        
        // Filtra por setor se a frequência for vinculada a um setor específico
        if (freqBase.setor_id) {
          rows = rows.filter((d: any) => d.profissionais?.setor_id === freqBase.setor_id);
        }

        return rows.map(d => ({
          ...d,
          id: d.profissional_id, 
          status_linha: (d.status === "aprovada" || d.status === "rejeitada") ? d.status : "pendente",
          observacao_analise: d.observacoes,
          analisado_em: null,
          analisado_por_usuario: null,
          plantoes_extras: d.plantoes,
          ferias: 0,
          licencas: 0,
          faltas_injustificadas: d.dias_falta
        })) as any[];
      }

      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select(`
          id, profissional_id, status_linha, observacao_analise, analisado_em, 
          dias_trabalhados, faltas_injustificadas, atestado, ferias, licencas, 
          ferias_terco, ferias_integral, adicional_noturno, he_50, he_100, 
          plantoes_extras, sobreaviso, incentivo, sal_sub_h, aulas_suplementares, 
          profissionais:profissional_id(nome_completo, matricula, setor_id), 
          analisado_por_usuario:analisado_por(nome_completo)
        `)
        .eq("frequencia_id", freqId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      
      const rows = (data ?? []) as unknown as (LinhaAnalise & { profissional_id: string; profissionais: { setor_id: string | null } })[];
      
      // Filtra por setor se a frequência for vinculada a um setor específico
      if (freqBase?.setor_id) {
        return rows.filter(r => r.profissionais?.setor_id === freqBase.setor_id);
      }

      return rows;
    },
  });

  // Busca a competência (ano/mes) desta frequência para calcular a anterior.
  const { data: compAtual } = useQuery({
    queryKey: ["frequencia-competencia", freqId],
    enabled: !!freqId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select(
          "competencia_unidades:competencia_unidade_id(competencias:competencia_id(id, ano, mes))",
        )
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

      const profIds = Array.from(
        new Set((linhas ?? []).map((l) => l.profissional_id).filter(Boolean)),
      );
      if (!profIds.length) return new Map<string, number>();

      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select(
          "profissional_id, he_50, he_100, frequencias!inner(competencia_unidades!inner(competencia_id))",
        )
        .in("profissional_id", profIds)
        .eq("frequencias.competencia_unidades.competencia_id", compPrev.id)
        .is("deleted_at", null);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as unknown as {
        profissional_id: string;
        he_50: number | null;
        he_100: number | null;
      }[]) {
        const total = Number(r.he_50 ?? 0) + Number(r.he_100 ?? 0);
        map.set(r.profissional_id, (map.get(r.profissional_id) ?? 0) + total);
      }
      return map;
    },
  });
  
  // Handlers para edição direta
  const handleUpdateLinha = async (pid: string, campo: string, valor: any) => {
    if (!freqBase) return;
    const cu = freqBase.competencia_unidades as any;
    
    // Atualiza estado local otimista
    const originalLinha = linhasArr.find(l => l.profissional_id === pid);
    if (!originalLinha) return;

    const payloadBase = {
      ...originalLinha,
      ...editMap[pid],
      [campo]: valor
    };

    try {
      if (freqBase.tipo === "efetivos") {
        await salvarEfetivosFn({
          data: {
            competencia_id: cu.competencia_id,
            unidade_id: cu.unidade_id,
            linhas: [{
              profissional_id: pid,
              dias_trabalhados: payloadBase.dias_trabalhados,
              faltas_injustificadas: payloadBase.faltas_injustificadas,
              atestado: payloadBase.atestado,
              he_50: payloadBase.he_50,
              he_100: payloadBase.he_100,
              ferias_terco: payloadBase.ferias_terco,
              ferias_integral: payloadBase.ferias_integral,
              sal_sub_h: payloadBase.sal_sub_h,
              adicional_noturno: payloadBase.adicional_noturno,
              aulas_suplementares: payloadBase.aulas_suplementares,
              sobreaviso: payloadBase.sobreaviso,
              plantoes_extras: payloadBase.plantoes_extras,
              incentivo: payloadBase.incentivo,
              ferias: payloadBase.ferias,
              licenca_premio: payloadBase.licenca_premio,
              status_linha: payloadBase.status_linha,
              observacoes: payloadBase.observacoes
            }]
          }
        });
      } else {
        await salvarContratadosFn({
          data: {
            competencia_id: cu.competencia_id,
            unidade_id: cu.unidade_id,
            linhas: [{
              profissional_id: pid,
              dias_trabalhados: payloadBase.dias_trabalhados,
              dias_falta: payloadBase.faltas_injustificadas || payloadBase.dias_falta,
              atestado: payloadBase.atestado,
              he_50: payloadBase.he_50,
              he_100: payloadBase.he_100,
              adn: payloadBase.adn || payloadBase.adicional_noturno,
              plantoes: payloadBase.plantoes || payloadBase.plantoes_extras,
              sobreaviso: payloadBase.sobreaviso,
              incentivo: payloadBase.incentivo,
              status: payloadBase.status || payloadBase.status_linha,
              observacoes: payloadBase.observacoes
            }]
          }
        });
      }
      
      setEditMap(prev => ({ ...prev, [pid]: { ...prev[pid], [campo]: valor } }));
      toast.success("Alteração salva");
      
      // Invalida para refletir no resumo e auditoria
      qc.invalidateQueries({ queryKey: ["frequencia-linhas-analise", freqId] });
      qc.invalidateQueries({ queryKey: ["aprovacoes-list"] });
      
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    }
  };

  const mut = useRetryMutation({
    retry: { operation: "frequencia_linha.aprovar_rejeitar" },
    mutationFn: async ({
      id,
      status,
      obs,
    }: {
      id: string;
      status: "aprovada" | "rejeitada";
      obs: string;
    }) => {
      if (status === "rejeitada" && !obs.trim()) {
        throw new Error("Informe a observação para rejeitar a linha.");
      }

      if (freqBase?.tipo === "contratados") {
        const cu = freqBase.competencia_unidades as any;
        const { error } = await supabase
          .from("frequencias_contratados")
          .update({
            status: status,
            observacoes: obs.trim() || null,
            aprovada_por: status === "aprovada" ? meId : null,
            aprovada_em: status === "aprovada" ? new Date().toISOString() : null,
            updated_by: meId,
          })
          .eq("competencia_id", cu.competencia_id)
          .eq("unidade_id", cu.unidade_id)
          .eq("profissional_id", id);
        if (error) throw error;
      } else {
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
      }
    },
    onSuccess: async () => {
      toast.success("Linha atualizada");
      qc.invalidateQueries({ queryKey: ["frequencia-linhas-analise", freqId] });
      qc.invalidateQueries({ queryKey: ["frequencia-profissional", freqId] });
      
      // Sincroniza metadados da folha após alterar uma linha
      if (freqBase) {
        const cu = freqBase.competencia_unidades as any;
        const { orquestrarSincronizacao } = await import("@/lib/frequencia-sincronizacao.functions");
        await orquestrarSincronizacao({
          data: {
            evento: "LINHA_ALTERADA",
            tipo: freqBase.tipo as any,
            competencia_id: cu.competencia_id,
            unidade_id: cu.unidade_id,
          }
        });
        qc.invalidateQueries({ queryKey: ["aprovacoes-list"] });
      }
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
    <Dialog
      open={!!freqId}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-[95vw] w-[1400px]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle>Análise detalhada por profissional</DialogTitle>
              <DialogDescription>
                Revise os lançamentos e tome decisões individuais. Status e auditoria são registrados automaticamente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        {(parametros?.limite_he_50 != null ||
          parametros?.limite_he_100 != null ||
          parametros?.limite_plantoes != null) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2 text-xs">
            <div>
              Alçada configurada:
              {parametros?.limite_he_50 != null && <> HE 50% ≤ {parametros.limite_he_50}</>}
              {parametros?.limite_he_100 != null && <> · HE 100% ≤ {parametros.limite_he_100}</>}
              {parametros?.limite_plantoes != null && (
                <> · Plantões ≤ {parametros.limite_plantoes}</>
              )}
              {" · "}
              <strong>{totalExcecoes}</strong> exceção(ões)
              {!isMaster && totalExcecoes > 0 && (
                <span className="ml-1 text-destructive">— aprovação restrita ao MASTER</span>
              )}
            </div>
            <Button
              size="sm"
              variant={soExcecoes ? "default" : "outline"}
              onClick={() => setSoExcecoes((v) => !v)}
            >
              {soExcecoes ? "Mostrar todas" : "Só exceções"}
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
        ) : !linhasVisiveis.length ? (
          <div className="p-4 text-sm text-muted-foreground">Nenhuma linha para exibir.</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-lg border custom-scrollbar">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 border-b bg-muted/90 backdrop-blur-sm z-10">
                <tr className="text-left text-[10px] uppercase tracking-wider">
                  <th className="p-2 border-r bg-muted/95 sticky left-0 z-20 min-w-[180px]">Profissional / Matrícula</th>
                  <th className="p-2 border-r text-center bg-muted/95">Status</th>
                  <th className="p-2 border-r text-center w-16 bg-muted/95">Dias</th>
                  <th className="p-2 border-r text-center w-16 bg-muted/95">Faltas</th>
                  <th className="p-2 border-r text-center w-16 bg-muted/95">ATT</th>
                  <th className="p-2 border-r text-center w-16 bg-amber-500/10">50%</th>
                  <th className="p-2 border-r text-center w-16 bg-amber-600/10">100%</th>
                  {freqBase?.tipo === "efetivos" && (
                    <>
                      <th className="p-2 border-r text-center w-16 bg-blue-500/10">1/3</th>
                      <th className="p-2 border-r text-center w-16 bg-blue-600/10">Int.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Not.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Plat.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Sob.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Inc.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Sub.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Aul.</th>
                    </>
                  )}
                  {freqBase?.tipo === "contratados" && (
                    <>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">ADN</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Plat.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Sob.</th>
                      <th className="p-2 border-r text-center w-16 bg-muted/95">Inc.</th>
                    </>
                  )}
                  <th className="p-2 border-r text-center w-24 bg-muted/95">Obs</th>
                  <th className="p-2 text-right w-20 bg-muted/95">Decisão</th>
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
                    <tr
                      key={l.id}
                      className={`border-b last:border-0 align-top ${excecao ? "bg-destructive/5" : ""}`}
                    >
                      <td className="p-3 border-r sticky left-0 bg-background/95 z-10">
                        <div className="font-semibold text-sm">{l.profissionais?.nome_completo ?? "—"}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                          <span className="bg-muted px-1 rounded font-mono">Mat. {l.profissionais?.matricula ?? "—"}</span>
                          {l.analisado_em && (
                            <span className="italic flex items-center gap-1">
                              · <CheckCircle2 className="h-2.5 w-2.5 text-green-600" /> 
                              {new Date(l.analisado_em).toLocaleDateString("pt-BR")}
                              {l.analisado_por_usuario?.nome_completo && ` (${l.analisado_por_usuario.nome_completo})`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 border-r text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Badge variant={STATUS_LINHA_VARIANT[l.status_linha]} className="text-[10px] px-1.5 py-0 h-5">
                            {STATUS_LINHA_LABEL[l.status_linha]}
                          </Badge>
                          {excecao && (
                            <div className="text-[9px] font-bold text-destructive leading-tight max-w-[100px]" title={motivos.join(" · ")}>
                              {motivos[0]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border-r text-center font-medium bg-muted/10">
                        {String((l as any).dias_trabalhados ?? 0)}
                      </td>
                      <td className="p-2 border-r text-center font-medium text-destructive/80">
                        {String((l as any).faltas_injustificadas ?? (l as any).dias_falta ?? 0)}
                      </td>
                      <td className="p-2 border-r text-center font-medium text-blue-600/80">
                        {String((l as any).atestado ?? 0)}
                      </td>
                      <td className="p-2 border-r text-center font-bold text-amber-600 bg-amber-500/5">
                        {String(l.he_50 ?? 0)}
                      </td>
                      <td className="p-2 border-r text-center font-bold text-amber-700 bg-amber-600/5">
                        {String(l.he_100 ?? 0)}
                      </td>
                      {freqBase?.tipo === "efetivos" && (
                        <>
                          <td className="p-2 border-r text-center font-medium text-blue-700 bg-blue-500/5">
                            {String((l as any).ferias_terco ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium text-blue-800 bg-blue-600/5">
                            {String((l as any).ferias_integral ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).adicional_noturno ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String(l.plantoes_extras ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).sobreaviso ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).incentivo ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).sal_sub_h ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).aulas_suplementares ?? 0)}
                          </td>
                        </>
                      )}
                      {freqBase?.tipo === "contratados" && (
                        <>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).adn ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).plantoes ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).sobreaviso ?? 0)}
                          </td>
                          <td className="p-2 border-r text-center font-medium">
                            {String((l as any).incentivo ?? 0)}
                          </td>
                        </>
                      )}
                      <td className="p-3 border-r">
                        <Input
                          placeholder="Motivo da decisão..."
                          defaultValue={l.observacao_analise ?? ""}
                          onChange={(e) => setObsMap((m) => ({ ...m, [l.id]: e.target.value }))}
                          className="h-7 text-[11px] min-w-[150px]"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {canAprovar && (
                            <Button
                              size="sm"
                              variant={l.status_linha === "aprovada" ? "secondary" : "default"}
                              className="h-7 w-7 p-0"
                              disabled={mut.isPending || bloqueado}
                              title={bloqueado ? "Exceção: só MASTER aprova." : "Aprovar linha"}
                              onClick={() =>
                                mut.mutate({
                                  id: l.id,
                                  status: "aprovada",
                                  obs: obsMap[l.id] ?? l.observacao_analise ?? "",
                                })
                              }
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canRejeitar && (
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 w-7 p-0"
                              disabled={mut.isPending}
                              title="Rejeitar linha"
                              onClick={() =>
                                mut.mutate({
                                  id: l.id,
                                  status: "rejeitada",
                                  obs: obsMap[l.id] ?? l.observacao_analise ?? "",
                                })
                              }
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
