import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-permissions";
import {
  setPerfilPermissao,
  setPerfilPermissoesEmMassa,
  setPerfilPermissaoUnidade,
  setPerfilPermissoesUnidadeEmMassa,
} from "@/lib/profiles-admin.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/configuracao/perfis/$id")({
  component: PerfilMatriz,
});

const MODULOS_SENSIVEIS = new Set(["usuario", "perfil", "permissao", "configuracao", "auditoria", "sistema"]);

const MODULO_LABEL: Record<string, string> = {
  dashboard: "Painel",
  frequencia: "Frequências",
  competencia: "Competências",
  profissional: "Profissionais",
  unidade: "Unidades",
  secretaria: "Secretarias",
  relatorio: "Relatórios",
  documento: "Documentos",
  notificacao: "Notificações",
  assinatura: "Assinaturas",
  pendencia: "Pendências",
  piso: "Piso da Enfermagem",
  usuario: "Usuários",
  perfil: "Perfis",
  permissao: "Permissões",
  configuracao: "Configuração",
  auditoria: "Auditoria",
  sistema: "Sistema",
};

type Perfil = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  nivel_hierarquico: number;
  admin_2fa_required: boolean;
  is_sistema: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

type Permissao = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  modulo: string;
  categoria: string;
};

function PerfilMatriz() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: userCtx } = useCurrentUser();
  const isMaster = userCtx?.is_master === true;

  const [busca, setBusca] = useState("");
  const [moduloFiltro, setModuloFiltro] = useState<string>("__all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copySrc, setCopySrc] = useState<string>("");
  // "" = padrão do perfil; uuid = editando overrides desta unidade
  const [unidadeSel, setUnidadeSel] = useState<string>("");


  const { data: perfil } = useQuery({
    queryKey: ["perfil-detail", id],
    queryFn: async (): Promise<Perfil | null> => {
      const { data, error } = await supabase
        .from("perfis")
        .select(
          "id, codigo, nome, descricao, nivel_hierarquico, admin_2fa_required, is_sistema, status, created_at, updated_at, created_by, updated_by",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Perfil) ?? null;
    },
  });

  const { data: perfis = [] } = useQuery({
    queryKey: ["perfis-admin"],
    queryFn: async (): Promise<Perfil[]> => {
      const { data, error } = await supabase
        .from("perfis")
        .select(
          "id, codigo, nome, descricao, nivel_hierarquico, admin_2fa_required, is_sistema, status, created_at, updated_at, created_by, updated_by",
        )
        .is("deleted_at", null)
        .order("nivel_hierarquico");
      if (error) throw error;
      return (data ?? []) as Perfil[];
    },
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ["permissoes-all"],
    queryFn: async (): Promise<Permissao[]> => {
      const { data, error } = await supabase
        .from("permissoes")
        .select("id, codigo, nome, descricao, modulo, categoria")
        .eq("ativa", true)
        .is("deleted_at", null)
        .order("modulo")
        .order("codigo");
      if (error) throw error;
      return (data ?? []) as Permissao[];
    },
  });

  const { data: concedidas = new Set<string>() } = useQuery({
    queryKey: ["perfil-perms", id],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("perfil_permissoes")
        .select("permissao_id, concedida")
        .eq("perfil_id", id);
      if (error) throw error;
      return new Set(
        (data ?? [])
          .filter((r: { concedida: boolean }) => r.concedida)
          .map((r: { permissao_id: string }) => r.permissao_id),
      );
    },
  });

  const { data: usersImpactados = 0 } = useQuery({
    queryKey: ["perfil-users-total", id],
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("usuarios")
        .select("id", { count: "exact", head: true })
        .eq("perfil_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-ativas-min"],
    queryFn: async (): Promise<Array<{ id: string; nome: string }>> => {
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string }>;
    },
  });

  const { data: overrides = { granted: new Set<string>(), revoked: new Set<string>() } } = useQuery({
    queryKey: ["perfil-perms-unidade", id, unidadeSel],
    enabled: !!unidadeSel,
    queryFn: async (): Promise<{ granted: Set<string>; revoked: Set<string> }> => {
      const { data, error } = await supabase
        .from("perfil_permissoes_unidade")
        .select("permissao_id, concedida")
        .eq("perfil_id", id)
        .eq("unidade_id", unidadeSel);
      if (error) throw error;
      const g = new Set<string>();
      const r = new Set<string>();
      for (const row of (data ?? []) as Array<{ permissao_id: string; concedida: boolean }>) {
        (row.concedida ? g : r).add(row.permissao_id);
      }
      return { granted: g, revoked: r };
    },
  });

  const isMasterProfile = perfil?.codigo === "MASTER";
  const readOnly = !isMaster || isMasterProfile;
  const unitMode = !!unidadeSel;

  const setOneFn = useServerFn(setPerfilPermissao);
  const bulkFn = useServerFn(setPerfilPermissoesEmMassa);
  const setOneUnitFn = useServerFn(setPerfilPermissaoUnidade);
  const bulkUnitFn = useServerFn(setPerfilPermissoesUnidadeEmMassa);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["perfil-perms", id] });
    qc.invalidateQueries({ queryKey: ["perfil-perms-unidade", id] });
    qc.invalidateQueries({ queryKey: ["perfis-perms-count"] });
  };


  // Helpers de estado efetivo (padrão do perfil + override, se em modo unidade)
  const effective = (permissao_id: string): boolean => {
    if (unitMode) {
      if (overrides.granted.has(permissao_id)) return true;
      if (overrides.revoked.has(permissao_id)) return false;
    }
    return concedidas.has(permissao_id);
  };
  const isOverridden = (permissao_id: string): boolean =>
    unitMode &&
    (overrides.granted.has(permissao_id) || overrides.revoked.has(permissao_id));

  const toggleOne = useMutation({
    mutationFn: async (args: { permissao_id: string; concedida: boolean }) => {
      if (unitMode) {
        await setOneUnitFn({
          data: {
            perfil_id: id,
            permissao_id: args.permissao_id,
            unidade_id: unidadeSel,
            concedida: args.concedida,
          },
        });
      } else {
        await setOneFn({
          data: { perfil_id: id, permissao_id: args.permissao_id, concedida: args.concedida },
        });
      }
    },
    onSuccess: () => {
      toast.success(unitMode ? "Sobreposição salva nesta unidade." : "Permissão atualizada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearOverride = useMutation({
    mutationFn: async (permissao_id: string) => {
      await setOneUnitFn({
        data: {
          perfil_id: id,
          permissao_id,
          unidade_id: unidadeSel,
          concedida: null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Sobreposição removida — voltou ao padrão do perfil.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulk = useMutation({
    mutationFn: async (args: { permissao_ids: string[]; concedida: boolean | null }) => {
      if (unitMode) {
        await bulkUnitFn({
          data: {
            perfil_id: id,
            unidade_id: unidadeSel,
            permissao_ids: args.permissao_ids,
            concedida: args.concedida,
          },
        });
      } else {
        if (args.concedida === null) return; // no-op para modo padrão
        await bulkFn({
          data: {
            perfil_id: id,
            permissao_ids: args.permissao_ids,
            concedida: args.concedida,
          },
        });
      }
    },
    onSuccess: (_d, args) => {
      const acao =
        args.concedida === null
          ? "voltaram ao padrão"
          : args.concedida
            ? "concedidas"
            : "revogadas";
      toast.success(`${args.permissao_ids.length} permissão(ões) ${acao}.`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  // -------------------------------------------------------------------------
  // Filtro + agrupamento
  // -------------------------------------------------------------------------
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return permissoes.filter((p) => {
      if (moduloFiltro !== "__all" && p.modulo !== moduloFiltro) return false;
      if (!q) return true;
      return (
        p.codigo.toLowerCase().includes(q) ||
        p.nome.toLowerCase().includes(q) ||
        (p.descricao ?? "").toLowerCase().includes(q)
      );
    });
  }, [permissoes, busca, moduloFiltro]);

  const grouped = useMemo(() => {
    const g: Record<string, Permissao[]> = {};
    for (const p of filtradas) (g[p.modulo] ??= []).push(p);
    return g;
  }, [filtradas]);

  const modulos = useMemo(
    () => Array.from(new Set(permissoes.map((p) => p.modulo))).sort(),
    [permissoes],
  );

  const totalPerms = permissoes.length;
  const totalConcedidas = concedidas.size;

  const askCopy = () => {
    if (!copySrc) return;
    const src = perfis.find((p) => p.id === copySrc);
    if (!src) return;
    // Fetch source perms then apply
    (async () => {
      const { data, error } = await supabase
        .from("perfil_permissoes")
        .select("permissao_id, concedida")
        .eq("perfil_id", copySrc);
      if (error) {
        toast.error(error.message);
        return;
      }
      const ids = (data ?? [])
        .filter((r: { concedida: boolean }) => r.concedida)
        .map((r: { permissao_id: string }) => r.permissao_id);
      if (ids.length === 0) {
        toast.info("O perfil de origem não tem permissões concedidas.");
        return;
      }
      bulk.mutate({ permissao_ids: ids, concedida: true });
    })();
  };

  const toggleCollapsed = (m: string) => setCollapsed((s) => ({ ...s, [m]: !s[m] }));

  const grantAll = () => {
    const ids = filtradas.map((p) => p.id).filter((pid) => !effective(pid));
    if (ids.length === 0) return;
    bulk.mutate({ permissao_ids: ids, concedida: true });
  };
  const revokeAll = () => {
    const ids = filtradas.map((p) => p.id).filter((pid) => effective(pid));
    if (ids.length === 0) return;
    bulk.mutate({ permissao_ids: ids, concedida: false });
  };
  const invertAll = () => {
    const grant = filtradas.map((p) => p.id).filter((pid) => !effective(pid));
    const revoke = filtradas.map((p) => p.id).filter((pid) => effective(pid));
    if (grant.length > 0) bulk.mutate({ permissao_ids: grant, concedida: true });
    if (revoke.length > 0) bulk.mutate({ permissao_ids: revoke, concedida: false });
  };
  const clearOverridesFiltradas = () => {
    if (!unitMode) return;
    const ids = filtradas
      .map((p) => p.id)
      .filter((pid) => overrides.granted.has(pid) || overrides.revoked.has(pid));
    if (ids.length === 0) return;
    bulk.mutate({ permissao_ids: ids, concedida: null });
  };

  const moduloBulk = (m: string, concedida: boolean) => {
    const list = grouped[m] ?? [];
    const ids = list
      .map((p) => p.id)
      .filter((pid) => (concedida ? !effective(pid) : effective(pid)));
    if (ids.length === 0) return;
    bulk.mutate({ permissao_ids: ids, concedida });
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/configuracao/perfis">
            <ArrowLeft className="mr-1 h-4 w-4" /> Perfis
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{perfil?.nome ?? "…"}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{perfil?.codigo}</code>
            {perfil?.is_sistema && <Badge variant="secondary">Sistema</Badge>}
            <Badge variant={perfil?.status === "ativa" ? "default" : "secondary"}>
              {perfil?.status}
            </Badge>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {usersImpactados} usuário(s) impactado(s)
            </span>
          </div>
          {perfil?.descricao && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{perfil.descricao}</p>
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div>
            Criado em{" "}
            <span className="font-medium">
              {perfil ? format(new Date(perfil.created_at), "dd/MM/yyyy HH:mm") : "—"}
            </span>
          </div>
          <div>
            Última alteração{" "}
            <span className="font-medium">
              {perfil ? format(new Date(perfil.updated_at), "dd/MM/yyyy HH:mm") : "—"}
            </span>
          </div>
          <div>
            Concedidas <span className="font-medium">{totalConcedidas}</span> de {totalPerms}
          </div>
        </div>
      </div>

      {isMasterProfile && (
        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>MASTER tem acesso total por design</AlertTitle>
          <AlertDescription>
            A matriz é somente leitura para este perfil — todas as permissões são concedidas
            no runtime através de <code>is_master()</code>, independente do que esteja marcado
            aqui.
          </AlertDescription>
        </Alert>
      )}

      {!isMaster && !isMasterProfile && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Somente MASTER pode alterar a matriz</AlertTitle>
          <AlertDescription>
            Você pode visualizar as permissões deste perfil, mas não pode alterá-las.
          </AlertDescription>
        </Alert>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Pesquisar permissão (código, nome ou descrição)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={moduloFiltro} onValueChange={setModuloFiltro}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todos os módulos</SelectItem>
              {modulos.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODULO_LABEL[m] ?? m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={unidadeSel || "__default"}
            onValueChange={(v) => setUnidadeSel(v === "__default" ? "" : v)}
          >
            <SelectTrigger className="sm:w-64" aria-label="Escopo (padrão do perfil ou unidade)">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Padrão do perfil (todas as unidades)</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  Sobreposição · {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={readOnly || bulk.isPending} onClick={grantAll}>
            Marcar tudo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly || bulk.isPending}
            onClick={revokeAll}
          >
            Desmarcar tudo
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={readOnly || bulk.isPending}
            onClick={invertAll}
          >
            Inverter seleção
          </Button>
          {unitMode && (
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || bulk.isPending}
              onClick={clearOverridesFiltradas}
              title="Remove sobreposições visíveis e faz esta unidade voltar ao padrão do perfil"
            >
              Limpar sobreposições
            </Button>
          )}
        </div>
      </div>

      {unitMode && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Editando sobreposições da unidade</AlertTitle>
          <AlertDescription>
            Alterações aqui valem apenas para a unidade selecionada. Permissões sem sobreposição
            seguem o padrão do perfil; sobreposições individuais por usuário continuam com
            prioridade absoluta.
          </AlertDescription>
        </Alert>
      )}


      {/* Copy from another profile */}
      {!readOnly && (
        <div className="flex flex-col items-start gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center">
          <Copy className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Copiar permissões de outro perfil:</span>
          <Select value={copySrc} onValueChange={setCopySrc}>
            <SelectTrigger className="sm:w-72">
              <SelectValue placeholder="Selecione um perfil…" />
            </SelectTrigger>
            <SelectContent>
              {perfis
                .filter((p) => p.id !== id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} ({p.codigo})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={askCopy} disabled={!copySrc || bulk.isPending}>
            Copiar permissões concedidas
          </Button>
          {usersImpactados > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              {usersImpactados} usuário(s) serão impactado(s)
            </span>
          )}
        </div>
      )}

      {/* Groups */}
      <div className="space-y-3">
        {Object.entries(grouped)
          .sort(([a], [b]) => (MODULO_LABEL[a] ?? a).localeCompare(MODULO_LABEL[b] ?? b))
          .map(([modulo, list]) => {
            const isCollapsed = collapsed[modulo] === true;
            const sensitive = MODULOS_SENSIVEIS.has(modulo);
            const grantedCount = list.filter((p) => effective(p.id)).length;
            return (
              <div key={modulo} className="overflow-hidden rounded-md border bg-card">
                <button
                  type="button"
                  onClick={() => toggleCollapsed(modulo)}
                  className="flex w-full items-center justify-between gap-3 border-b bg-muted/40 px-3 py-2 text-left hover:bg-muted/60"
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                      {MODULO_LABEL[modulo] ?? modulo}
                    </span>
                    {sensitive && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive"
                      >
                        <ShieldAlert className="mr-1 h-3 w-3" /> Sensível
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {grantedCount}/{list.length}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded border px-2 py-0.5 hover:bg-background disabled:opacity-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) moduloBulk(modulo, true);
                      }}
                    >
                      Todos
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      className="rounded border px-2 py-0.5 hover:bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) moduloBulk(modulo, false);
                      }}
                    >
                      Nenhum
                    </span>
                  </div>
                </button>
                {!isCollapsed && (
                  <div className="divide-y">
                    {list.map((p) => {
                      const on = effective(p.id);
                      const overridden = isOverridden(p.id);
                      const perfilDefault = concedidas.has(p.id);
                      return (
                        <label
                          key={p.id}
                          className="flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-muted/30"
                        >
                          <Checkbox
                            checked={on}
                            disabled={readOnly || toggleOne.isPending}
                            onCheckedChange={(v) =>
                              toggleOne.mutate({
                                permissao_id: p.id,
                                concedida: v === true,
                              })
                            }
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium">{p.nome}</span>
                              <code className="text-xs text-muted-foreground">{p.codigo}</code>
                              <span className="text-xs text-muted-foreground">
                                · {p.categoria}
                              </span>
                              {overridden && (
                                <Badge variant="outline" className="border-primary/50 text-primary">
                                  Sobreposto (padrão: {perfilDefault ? "concedido" : "revogado"})
                                </Badge>
                              )}
                            </div>
                            {p.descricao && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {p.descricao}
                              </div>
                            )}
                          </div>
                          {overridden && !readOnly && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={clearOverride.isPending}
                              onClick={(e) => {
                                e.preventDefault();
                                clearOverride.mutate(p.id);
                              }}
                              title="Remover sobreposição e voltar ao padrão do perfil"
                            >
                              Herdar
                            </Button>
                          )}
                        </label>
                      );
                    })}

                  </div>
                )}
              </div>
            );
          })}
        {Object.keys(grouped).length === 0 && (
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhuma permissão corresponde ao filtro.
          </div>
        )}
      </div>
    </div>
  );
}
