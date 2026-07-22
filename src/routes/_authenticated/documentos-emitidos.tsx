import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, ExternalLink, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/documentos-emitidos")({
  component: DocumentosEmitidosPage,
});

type DocRow = {
  id: string;
  tipo: string;
  descricao: string;
  assinado_por_nome: string | null;
  assinado_em: string;
  status: string | null;
  revogado_em: string | null;
  motivo_revogacao: string | null;
  hash_conteudo: string;
};

function DocumentosEmitidosPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("documento.gerenciar") || has("relatorio.exportar");

  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState<string>("");
  const [ate, setAte] = useState<string>("");

  const [revogar, setRevogar] = useState<DocRow | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["documentos-emitidos", tipo, status, desde, ate],
    enabled: canView,
    queryFn: async () => {
      let q = supabase
        .from("documentos_assinados_publico")
        .select(
          "id, tipo, descricao, assinado_por_nome, assinado_em, status, revogado_em, motivo_revogacao, hash_conteudo",
        )
        .order("assinado_em", { ascending: false })
        .limit(500);
      if (tipo !== "all") q = q.eq("tipo", tipo);
      if (status !== "all") q = q.eq("status", status);
      if (desde) q = q.gte("assinado_em", desde);
      if (ate) q = q.lte("assinado_em", `${ate}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DocRow[];
    },
  });

  const filtradas = useMemo(() => {
    if (!busca.trim()) return data;
    const t = busca.trim().toLowerCase();
    return data.filter((d) =>
      [d.descricao, d.tipo, d.assinado_por_nome ?? "", d.id, d.hash_conteudo]
        .join(" ")
        .toLowerCase()
        .includes(t),
    );
  }, [data, busca]);

  const tipos = useMemo(() => {
    const s = new Set(data.map((d) => d.tipo));
    return Array.from(s).sort();
  }, [data]);

  const revogarMut = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase.rpc("revogar_documento_assinado", {
        _id: id,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento revogado com sucesso.");
      setRevogar(null);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["documentos-emitidos"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar.");
    },
  });

  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Você não tem permissão para visualizar esta tela.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Documentos Emitidos</h1>
        <p className="text-sm text-muted-foreground">
          Trilha oficial de todos os documentos assinados eletronicamente. Autor ou Master pode
          revogar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end">
        <div className="md:col-span-2">
          <label className="text-xs text-muted-foreground">Busca</label>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Descrição, autor, protocolo, hash..."
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Status</label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="revogado">Revogados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Protocolo</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Autor</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : filtradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum documento encontrado.
                </td>
              </tr>
            ) : (
              filtradas.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{d.id.slice(0, 8)}…</td>
                  <td className="px-3 py-2">{d.tipo}</td>
                  <td className="px-3 py-2 max-w-[380px] truncate" title={d.descricao}>
                    {d.descricao}
                  </td>
                  <td className="px-3 py-2">{d.assinado_por_nome ?? "—"}</td>
                  <td className="px-3 py-2">{new Date(d.assinado_em).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    {d.status === "revogado" ? (
                      <Badge variant="destructive" className="gap-1">
                        <ShieldOff className="h-3 w-3" /> Revogado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Ativo
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/validar/$id" params={{ id: d.id }} target="_blank">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {d.status !== "revogado" && (
                        <Button size="sm" variant="outline" onClick={() => setRevogar(d)}>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!revogar}
        onOpenChange={(o) => {
          if (!o) {
            setRevogar(null);
            setMotivo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar documento</DialogTitle>
            <DialogDescription>
              A revogação é <strong>irreversível</strong> e ficará registrada na trilha de
              auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Documento</p>
              <p className="font-medium">{revogar?.descricao}</p>
            </div>
            <label className="text-xs text-muted-foreground">
              Motivo (obrigatório, mínimo 5 caracteres)
            </label>
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: erro de digitação na competência, versão substituída por..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevogar(null);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 5 || revogarMut.isPending}
              onClick={() =>
                revogar && revogarMut.mutate({ id: revogar.id, motivo: motivo.trim() })
              }
            >
              {revogarMut.isPending ? "Revogando..." : "Confirmar revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
