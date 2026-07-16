import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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

  const filtradas = useMemo(() => {
    if (!folha) return [];
    const q = busca.trim().toLowerCase();
    return folha.filter((it: any) => {
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

      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-2 whitespace-nowrap">Matrícula</th>
              <th className="text-left px-2 py-2 min-w-[180px]">Profissional</th>
              <th className="text-left px-2 py-2 whitespace-nowrap">Cargo</th>
              <th className="text-left px-2 py-2 whitespace-nowrap">Banco</th>
              <th className="text-left px-2 py-2 whitespace-nowrap">AG</th>
              <th className="text-left px-2 py-2 whitespace-nowrap">CC</th>
              <th className="text-right px-2 py-2">Faltas</th>
              <th className="text-right px-2 py-2">ATT</th>
              <th className="text-right px-2 py-2">HE 50%</th>
              <th className="text-right px-2 py-2">HE 100%</th>
              <th className="text-right px-2 py-2">ADN</th>
              <th className="text-right px-2 py-2">Plantões</th>
              <th className="text-right px-2 py-2">Sobreaviso</th>
              <th className="text-right px-2 py-2">Incentivo</th>
              <th className="text-left px-2 py-2 min-w-[160px]">Obs.</th>
              <th className="text-center px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {isFetching && (
              <tr><td colSpan={16} className="px-3 py-6 text-center text-muted-foreground">Carregando…</td></tr>
            )}
            {!isFetching && filtradas.length === 0 && (
              <tr><td colSpan={16} className="px-3 py-6 text-center text-muted-foreground">
                Nenhum profissional contratado nesta unidade.
              </td></tr>
            )}
            {filtradas.map((it: any) => {
              const p = it.profissional;
              const l = linhas[p.id];
              const ro = readonlyLinha(l);
              return (
                <tr key={p.id} className="border-t align-top hover:bg-muted/20">
                  <td className="px-2 py-1.5 font-mono text-xs">{p.matricula ?? "-"}</td>
                  <td className="px-2 py-1.5">{p.nome}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.cargo ?? "-"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{p.banco ?? "-"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground font-mono">{p.agencia ?? "-"}</td>
                  <td className="px-2 py-1.5 text-muted-foreground font-mono">{p.conta_corrente ?? "-"}</td>
                  {CAMPOS_NUM.map((c) => (
                    <td key={c} className="px-1 py-1">
                      <Input
                        type="number" min={0} step={c === "incentivo" ? "0.01" : "1"}
                        value={l?.[c] ?? 0}
                        onChange={(e) => updateCampo(p.id, c, e.target.value)}
                        disabled={ro}
                        className="h-8 text-right w-20"
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <Textarea
                      value={l?.observacoes ?? ""}
                      onChange={(e) => updateCampo(p.id, "observacoes", e.target.value)}
                      disabled={ro}
                      rows={1}
                      className="min-h-8 text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <StatusBadge domain="frequencia" value={l?.status ?? "rascunho"} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Os campos <strong>Banco</strong>, <strong>Agência</strong> e <strong>Conta Corrente</strong> são somente leitura aqui —
        são atualizados no cadastro do profissional.
      </p>
    </div>
  );
}
