import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, Plus, Power, PowerOff, Signature, Stamp, Image as ImageIcon, Trash2 } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: AssinaturasPage,
});

type Tipo = Database["public"]["Enums"]["tipo_assinatura"];

const TIPO_LABEL: Record<Tipo, string> = {
  assinatura: "Assinatura",
  carimbo: "Carimbo",
  logo: "Logo / Brasão",
};

const TIPO_ICON: Record<Tipo, typeof Signature> = {
  assinatura: Signature,
  carimbo: Stamp,
  logo: ImageIcon,
};

const BUCKET = "assinaturas";

function AssinaturasPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const canGerenciar = has("assinatura.gerenciar");

  const { data: secretarias } = useQuery({
    queryKey: ["secretarias-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretarias")
        .select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades")
        .select("id, nome, secretaria_id").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["assinaturas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas_institucionais")
        .select(`
          id, tipo, titular_nome, titular_cargo, storage_path, mime_type,
          vigencia_inicio, vigencia_fim, ativa, created_at,
          secretaria_id, unidade_id,
          secretarias:secretaria_id(nome),
          unidades:unidade_id(nome)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("assinaturas_institucionais")
        .update({ ativa, updated_by: me?.id }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinaturas-list"] });
      toast.success("Vigência atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: NonNullable<typeof rows>[number]) => {
      const { error } = await supabase.from("assinaturas_institucionais")
        .update({ deleted_at: new Date().toISOString(), deleted_by: me?.id, ativa: false })
        .eq("id", row.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinaturas-list"] });
      toast.success("Assinatura removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Assinaturas institucionais</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de assinaturas, carimbos e brasões usados nos relatórios oficiais.
          </p>
        </div>
        {canGerenciar && (
          <Button onClick={() => setOpenForm(true)}>
            <Plus className="mr-1 h-4 w-4" />Nova assinatura
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !rows?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma assinatura cadastrada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Titular</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Escopo</th>
                <th className="p-3">Vigência</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = TIPO_ICON[r.tipo];
                const escopo = r.unidades?.nome
                  ? `Unidade · ${r.unidades.nome}`
                  : r.secretarias?.nome
                    ? `Secretaria · ${r.secretarias.nome}`
                    : "Global";
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3">
                      <div className="font-medium">{r.titular_nome}</div>
                      {r.titular_cargo && (
                        <div className="text-xs text-muted-foreground">{r.titular_cargo}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        {TIPO_LABEL[r.tipo]}
                      </div>
                    </td>
                    <td className="p-3">{escopo}</td>
                    <td className="p-3 text-xs">
                      {r.vigencia_inicio ? new Date(r.vigencia_inicio).toLocaleDateString("pt-BR") : "—"}
                      {" → "}
                      {r.vigencia_fim ? new Date(r.vigencia_fim).toLocaleDateString("pt-BR") : "indefinido"}
                    </td>
                    <td className="p-3">
                      <Badge variant={r.ativa ? "default" : "outline"}>
                        {r.ativa ? "Ativa" : "Inativa"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <PreviewButton path={r.storage_path} mime={r.mime_type} />
                        {canGerenciar && (
                          <>
                            <Button size="sm" variant="outline"
                              onClick={() => toggleAtiva.mutate({ id: r.id, ativa: !r.ativa })}>
                              {r.ativa ? <PowerOff className="mr-1 h-4 w-4" /> : <Power className="mr-1 h-4 w-4" />}
                              {r.ativa ? "Inativar" : "Ativar"}
                            </Button>
                            <Button size="sm" variant="ghost"
                              onClick={() => { if (confirm(`Remover assinatura de ${r.titular_nome}?`)) remove.mutate(r); }}>
                              <Trash2 className="h-4 w-4" />
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

      {openForm && (
        <NovaAssinaturaDialog
          onClose={() => setOpenForm(false)}
          secretarias={secretarias ?? []}
          unidades={unidades ?? []}
          userId={me?.id}
          onSaved={() => {
            setOpenForm(false);
            qc.invalidateQueries({ queryKey: ["assinaturas-list"] });
          }}
        />
      )}
    </div>
  );
}

function PreviewButton({ path, mime }: { path: string; mime: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function abrir() {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
    if (error) { toast.error(error.message); return; }
    setUrl(data.signedUrl);
    setOpen(true);
  }

  const isImage = (mime ?? "").startsWith("image/");

  return (
    <>
      <Button size="sm" variant="ghost" onClick={abrir}>
        <Eye className="mr-1 h-4 w-4" />Visualizar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
          </DialogHeader>
          {url && (isImage ? (
            <img src={url} alt="Assinatura" className="max-h-[70vh] w-full object-contain bg-muted/30 rounded" />
          ) : (
            <iframe src={url} className="h-[70vh] w-full rounded border" title="Arquivo" />
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

type LookupSec = { id: string; nome: string };
type LookupUni = { id: string; nome: string; secretaria_id: string | null };

function NovaAssinaturaDialog({
  onClose, onSaved, secretarias, unidades, userId,
}: {
  onClose: () => void; onSaved: () => void;
  secretarias: LookupSec[]; unidades: LookupUni[]; userId?: string;
}) {
  const [tipo, setTipo] = useState<Tipo>("assinatura");
  const [titularNome, setTitularNome] = useState("");
  const [titularCargo, setTitularCargo] = useState("");
  const [escopo, setEscopo] = useState<"global" | "secretaria" | "unidade">("global");
  const [secretariaId, setSecretariaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [vigenciaInicio, setVigenciaInicio] = useState("");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const unidadesFiltradas = useMemo(() => {
    if (escopo !== "unidade") return unidades;
    return unidades;
  }, [unidades, escopo]);

  useEffect(() => {
    if (escopo !== "unidade") setUnidadeId("");
    if (escopo === "global") setSecretariaId("");
  }, [escopo]);

  async function salvar() {
    if (!titularNome.trim()) { toast.error("Informe o nome do titular"); return; }
    if (!file) { toast.error("Selecione o arquivo"); return; }
    if (escopo === "secretaria" && !secretariaId) { toast.error("Selecione a secretaria"); return; }
    if (escopo === "unidade" && !unidadeId) { toast.error("Selecione a unidade"); return; }

    setSaving(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const scopeSeg = escopo === "unidade" ? `unidade/${unidadeId}`
        : escopo === "secretaria" ? `secretaria/${secretariaId}`
        : "global";
      const path = `${scopeSeg}/${tipo}/${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined, upsert: false,
      });
      if (up.error) throw up.error;

      const insert = await supabase.from("assinaturas_institucionais").insert({
        tipo,
        titular_nome: titularNome.trim(),
        titular_cargo: titularCargo.trim() || null,
        storage_path: path,
        mime_type: file.type || null,
        secretaria_id: escopo === "secretaria" ? secretariaId : escopo === "unidade"
          ? unidades.find((u) => u.id === unidadeId)?.secretaria_id ?? null
          : null,
        unidade_id: escopo === "unidade" ? unidadeId : null,
        vigencia_inicio: vigenciaInicio || null,
        vigencia_fim: vigenciaFim || null,
        ativa: true,
        created_by: userId,
      });
      if (insert.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insert.error;
      }
      toast.success("Assinatura cadastrada");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova assinatura</DialogTitle>
          <DialogDescription>Upload de assinatura, carimbo ou brasão institucional.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                  <SelectItem value="carimbo">Carimbo</SelectItem>
                  <SelectItem value="logo">Logo / Brasão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Escopo</Label>
              <Select value={escopo} onValueChange={(v) => setEscopo(v as typeof escopo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (município)</SelectItem>
                  <SelectItem value="secretaria">Secretaria</SelectItem>
                  <SelectItem value="unidade">Unidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {escopo === "secretaria" && (
            <div>
              <Label>Secretaria</Label>
              <Select value={secretariaId} onValueChange={setSecretariaId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {secretarias.map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {escopo === "unidade" && (
            <div>
              <Label>Unidade</Label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {unidadesFiltradas.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Titular</Label>
            <Input value={titularNome} onChange={(e) => setTitularNome(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label>Cargo / Função</Label>
            <Input value={titularCargo} onChange={(e) => setTitularCargo(e.target.value)} placeholder="Ex.: Secretário Municipal de Saúde" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Vigência início</Label>
              <Input type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Vigência fim</Label>
              <Input type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Arquivo (PNG, JPG ou PDF)</Label>
            <Input type="file" accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="mt-1 text-xs text-muted-foreground">
              PNG com fundo transparente é recomendado para assinaturas e carimbos.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={salvar}>{saving ? "Enviando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
