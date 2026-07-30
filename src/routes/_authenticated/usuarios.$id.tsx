import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setUsuarioPermissao } from "@/lib/users-admin.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Check, Minus, X } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useCurrentUser } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/usuarios/$id")({
  component: UsuarioDetail,
});

type Permissao = {
  id: string;
  codigo: string;
  nome: string;
  modulo: string;
  categoria: string;
};

type TipoPerm = Database["public"]["Enums"]["tipo_permissao_usuario"];
type Override = "herdar" | "concedida" | "revogada";

function UsuarioDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: userCtx } = useCurrentUser();
  const isMaster = userCtx?.is_master === true;

  const { data: usuario } = useQuery({
    queryKey: ["usuario", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id, nome_completo, email, perfil:perfis(id, nome, codigo)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: permissoes = [] } = useQuery({
    queryKey: ["permissoes-all"],
    queryFn: async (): Promise<Permissao[]> => {
      const { data, error } = await supabase
        .from("permissoes")
        .select("id, codigo, nome, modulo, categoria")
        .eq("ativa", true)
        .is("deleted_at", null)
        .order("modulo")
        .order("codigo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const perfilId = usuario?.perfil?.id ?? null;

  const { data: perfilPerms = new Set<string>() } = useQuery({
    queryKey: ["perfil-perms", perfilId],
    enabled: !!perfilId,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("perfil_permissoes")
        .select("permissao_id, concedida")
        .eq("perfil_id", perfilId!);
      if (error) throw error;
      return new Set((data ?? []).filter((r) => r.concedida).map((r) => r.permissao_id));
    },
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ["usuario-perms", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuario_permissoes")
        .select("id, permissao_id, tipo")
        .eq("usuario_id", id)
        .is("deleted_at", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const overrideMap = new Map<string, { id: string; tipo: TipoPerm }>();
  overrides.forEach((o) => overrideMap.set(o.permissao_id, { id: o.id, tipo: o.tipo }));

  const setPermFn = useServerFn(setUsuarioPermissao);
  const setOverride = useMutation({
    mutationFn: async (args: { permissao_id: string; state: Override }) => {
      await setPermFn({
        data: {
          usuario_id: id,
          permissao_id: args.permissao_id,
          state: args.state,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuario-perms", id] });
      toast.success("Permissão atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = permissoes.reduce<Record<string, Permissao[]>>((acc, p) => {
    (acc[p.modulo] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/usuarios">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{usuario?.nome_completo ?? "…"}</h1>
        <p className="text-sm text-muted-foreground">
          {usuario?.email} · Perfil:{" "}
          <Badge variant="secondary">{usuario?.perfil?.nome ?? "—"}</Badge>
        </p>
      </div>

      {!isMaster && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Somente usuário MASTER altera permissões</AlertTitle>
          <AlertDescription>
            Você pode visualizar esta tela, mas não pode conceder, revogar ou herdar permissões
            individuais.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border bg-card p-4">
        <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Minus className="h-3.5 w-3.5" /> Herdar do perfil
          </span>
          <span className="flex items-center gap-1 text-success">
            <Check className="h-3.5 w-3.5" /> Conceder individual
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <X className="h-3.5 w-3.5" /> Revogar individual
          </span>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([modulo, list]) => (
            <div key={modulo}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
                {modulo.replace(/_/g, " ")}
              </h3>
              <div className="divide-y rounded-md border">
                {list.map((p) => {
                  const ov = overrideMap.get(p.id);
                  const state: Override = ov ? (ov.tipo as Override) : "herdar";
                  const inheritGranted = perfilPerms.has(p.id);
                  const effective =
                    state === "concedida" ? true : state === "revogada" ? false : inheritGranted;

                  return (
                    <div key={p.id} className="flex items-center justify-between gap-4 px-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{p.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          <code>{p.codigo}</code>
                          {" · "}
                          Herdado:{" "}
                          <span
                            className={inheritGranted ? "text-success" : "text-muted-foreground"}
                          >
                            {inheritGranted ? "concedido" : "não concedido"}
                          </span>
                          {" · Efetivo: "}
                          <span className={effective ? "text-success" : "text-destructive"}>
                            {effective ? "permitido" : "negado"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {(["herdar", "concedida", "revogada"] as Override[]).map((opt) => {
                          const active = state === opt;
                          const Icon = opt === "concedida" ? Check : opt === "revogada" ? X : Minus;
                          const color =
                            opt === "concedida"
                              ? "text-success"
                              : opt === "revogada"
                                ? "text-destructive"
                                : "text-muted-foreground";
                          return (
                            <Button
                              key={opt}
                              size="sm"
                              variant={active ? "default" : "outline"}
                              className={active ? "" : color}
                              disabled={!isMaster || setOverride.isPending}
                              onClick={() => setOverride.mutate({ permissao_id: p.id, state: opt })}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
