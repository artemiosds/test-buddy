import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/shared/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Eye, Plus, Power, PowerOff, Signature, Stamp, Image as ImageIcon, Trash2, Settings2, ShieldCheck, BellRing, AlertCircle, CheckCircle2, PenLine } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { MinhaAssinaturaPage } from "@/routes/_authenticated/meu-perfil.assinatura";

const PERFIS_ELEGIVEIS_PESSOAL = ["MASTER", "GESTOR", "GESTAO", "DIRETOR", "DIRETOR_UNIDADE", "COORDENADOR"];

export const Route = createFileRoute("/_authenticated/assinaturas")({
  component: AssinaturasPage,
});

type Tipo = Database["public"]["Enums"]["tipo_assinatura"];

/** Tipos de documento suportados pelas regras. */
const TIPOS_DOCUMENTO = [
  { value: "frequencia", label: "Frequência" },
  { value: "folha_efetivos", label: "Folha — Efetivos" },
  { value: "folha_contratados", label: "Folha — Contratados" },
  { value: "piso", label: "Piso da Enfermagem" },
  { value: "relatorio", label: "Relatórios" },
] as const;
type TipoDoc = typeof TIPOS_DOCUMENTO[number]["value"];

/** Perfis funcionais que podem assinar (subset do que existe em `perfis`). */
const PERFIS_ASSINANTES = ["MASTER", "GESTOR", "DIRETOR_UNIDADE"] as const;
const PERFIL_LABEL: Record<string, string> = {
  MASTER: "Master",
  GESTOR: "Gestor / Secretário",
  DIRETOR_UNIDADE: "Diretor da Unidade",
};

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
  const isMaster = !!me?.is_master;
  const elegivelPessoal = !!me && PERFIS_ELEGIVEIS_PESSOAL.includes((me.perfil_codigo || "").toUpperCase());
  const podeGerenciar = isMaster || has("assinatura.gerenciar");
  const defaultTab = elegivelPessoal ? "minha" : "cadastro";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Assinaturas institucionais</h1>
        <p className="text-sm text-muted-foreground">
          Cadastro de assinaturas, carimbos e brasões, e regras de quem assina cada documento.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          {elegivelPessoal && (
            <TabsTrigger value="minha">
              <PenLine className="mr-2 h-4 w-4" />
              Minha assinatura
            </TabsTrigger>
          )}
          <TabsTrigger value="cadastro" disabled={!podeGerenciar}>
            <Signature className="mr-2 h-4 w-4" />
            Institucionais
          </TabsTrigger>
          <TabsTrigger value="regras" disabled={!isMaster}>
            <Settings2 className="mr-2 h-4 w-4" />
            Regras por documento
          </TabsTrigger>
          <TabsTrigger value="pendentes" disabled={!podeGerenciar}>
            <BellRing className="mr-2 h-4 w-4" />
            Pendentes
          </TabsTrigger>
        </TabsList>

        {elegivelPessoal && (
          <TabsContent value="minha">
            <MinhaAssinaturaPage />
          </TabsContent>
        )}
        <TabsContent value="cadastro">
          {podeGerenciar ? (
            <CadastroTab canGerenciar={has("assinatura.gerenciar")} me={me} />
          ) : (
            <div className="text-sm text-muted-foreground">Sem permissão.</div>
          )}
        </TabsContent>
        <TabsContent value="regras">
          {isMaster ? <RegrasTab /> : <div className="text-sm text-muted-foreground">Apenas usuários Master.</div>}
        </TabsContent>
        <TabsContent value="pendentes">
          {podeGerenciar ? <PendentesTab /> : (
            <div className="text-sm text-muted-foreground">Sem permissão.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PendentesTab() {
  const qc = useQueryClient();
  const { data: dash } = useQuery({
    queryKey: ["assinatura-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("assinatura_dashboard");
      if (error) throw error;
      return data as {
        total_elegiveis: number; com_assinatura: number; pendentes: number; expirando_30d: number;
      };
    },
  });

  const { data: pendentes, isLoading } = useQuery({
    queryKey: ["assinatura-pendentes"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("assinatura_pendentes");
      if (error) throw error;
      return (data ?? []) as Array<{
        usuario_id: string; nome: string; email: string;
        perfil_codigo: string; perfil_nome: string;
        unidade_id: string | null; unidade_nome: string | null;
        dias_pendente: number;
      }>;
    },
  });

  const notificar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("notificar_assinatura_pendentes");
      if (error) throw error;
      return data as number;
    },
    onSuccess: (n) => {
      toast.success(`${n} notificação(ões) enviada(s)`);
      qc.invalidateQueries({ queryKey: ["assinatura-pendentes"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <KPI label="Elegíveis" value={dash?.total_elegiveis ?? 0} icon={<ShieldCheck className="h-4 w-4 text-primary" />} />
        <KPI label="Com assinatura" value={dash?.com_assinatura ?? 0} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} />
        <KPI label="Pendentes" value={dash?.pendentes ?? 0} icon={<AlertCircle className="h-4 w-4 text-amber-600" />} />
        <KPI label="Vencendo em 30d" value={dash?.expirando_30d ?? 0} icon={<AlertCircle className="h-4 w-4 text-red-600" />} />
      </div>

      <div className="flex justify-end">
        <Button onClick={() => notificar.mutate()} disabled={notificar.isPending || (pendentes ?? []).length === 0}>
          <BellRing className="mr-2 h-4 w-4" />
          {notificar.isPending ? "Enviando…" : "Notificar todos os pendentes"}
        </Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3">Usuário</th>
              <th className="text-left p-3">Perfil</th>
              <th className="text-left p-3">Unidade</th>
              <th className="text-right p-3">Dias pendente</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
            ) : (pendentes ?? []).length === 0 ? (
              <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum usuário pendente 🎉</td></tr>
            ) : (
              (pendentes ?? []).map((p, i) => (
                <tr key={`${p.usuario_id}-${p.unidade_id ?? "x"}-${i}`} className="border-t">
                  <td className="p-3">
                    <div className="font-medium">{p.nome}</div>
                    <div className="text-xs text-muted-foreground">{p.email}</div>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary">{p.perfil_nome ?? p.perfil_codigo}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.unidade_nome ?? "—"}</td>
                  <td className="p-3 text-right">
                    <Badge variant={p.dias_pendente > 7 ? "destructive" : "outline"}>
                      {p.dias_pendente} dias
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
    </div>
  );
}

function CadastroTab({ canGerenciar, me }: { canGerenciar: boolean; me: ReturnType<typeof useCurrentUser>["data"] }) {
  const qc = useQueryClient();
  const askConfirm = useConfirm();
  const [openForm, setOpenForm] = useState(false);
  const [filterPerfil, setFilterPerfil] = useState<string>("todos");

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

  const { data: perfis } = useQuery({
    queryKey: ["perfis-assinantes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis")
        .select("id, codigo, nome").is("deleted_at", null)
        .in("codigo", PERFIS_ASSINANTES as unknown as string[]);
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
          secretaria_id, unidade_id, perfil_id, tipos_documento, obrigatoria, ordem,
          secretarias:secretaria_id(nome),
          unidades:unidade_id(nome),
          perfis:perfil_id(codigo, nome)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (filterPerfil === "todos") return rows;
    if (filterPerfil === "institucional") return rows.filter((r) => !r.perfil_id);
    return rows.filter((r) => r.perfis?.codigo === filterPerfil);
  }, [rows, filterPerfil]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="w-56">
            <Label className="text-xs">Filtrar por perfil</Label>
            <Select value={filterPerfil} onValueChange={setFilterPerfil}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="institucional">Institucional (logo / brasão)</SelectItem>
                {PERFIS_ASSINANTES.map((c) => (
                  <SelectItem key={c} value={c}>{PERFIL_LABEL[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        ) : !filteredRows.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma assinatura cadastrada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Titular</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Perfil</th>
                <th className="p-3">Documentos</th>
                <th className="p-3">Escopo</th>
                <th className="p-3">Vigência</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => {
                const Icon = TIPO_ICON[r.tipo];
                const escopo = r.unidades?.nome
                  ? `Unidade · ${r.unidades.nome}`
                  : r.secretarias?.nome
                    ? `Secretaria · ${r.secretarias.nome}`
                    : "Global";
                const perfilLabel = r.perfis?.codigo
                  ? (PERFIL_LABEL[r.perfis.codigo] ?? r.perfis.nome)
                  : "Institucional";
                const tiposDocs = (r.tipos_documento ?? []) as string[];
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
                    <td className="p-3">
                      <Badge variant={r.perfil_id ? "secondary" : "outline"}>
                        {perfilLabel}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {tiposDocs.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Todos</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {tiposDocs.map((t) => (
                            <Badge key={t} variant="outline" className="text-2xs">
                              {TIPOS_DOCUMENTO.find((d) => d.value === t)?.label ?? t}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-3">{escopo}</td>
                    <td className="p-3 text-xs">
                      {r.vigencia_inicio ? new Date(r.vigencia_inicio).toLocaleDateString("pt-BR") : "—"}
                      {" → "}
                      {r.vigencia_fim ? new Date(r.vigencia_fim).toLocaleDateString("pt-BR") : "indefinido"}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Badge variant={r.ativa ? "default" : "outline"}>
                          {r.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                        {r.obrigatoria && <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-label="Obrigatória" />}
                      </div>
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
                              onClick={() => {
                                void (async () => {
                                  const ok = await askConfirm({
                                    title: `Remover assinatura de ${r.titular_nome}?`,
                                    tone: "destructive",
                                    confirmLabel: "Remover",
                                  });
                                  if (ok) remove.mutate(r);
                                })();
                              }}>
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
          perfis={perfis ?? []}
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
type LookupPerfil = { id: string; codigo: string; nome: string };

function NovaAssinaturaDialog({
  onClose, onSaved, secretarias, unidades, perfis, userId,
}: {
  onClose: () => void; onSaved: () => void;
  secretarias: LookupSec[]; unidades: LookupUni[]; perfis: LookupPerfil[]; userId?: string;
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
  const [perfilId, setPerfilId] = useState<string>("__institucional__");
  const [obrigatoria, setObrigatoria] = useState(true);
  const [ordem, setOrdem] = useState<number>(1);
  const [tiposDoc, setTiposDoc] = useState<Set<TipoDoc>>(new Set());

  const unidadesFiltradas = useMemo(() => unidades, [unidades]);

  useEffect(() => {
    if (escopo !== "unidade") setUnidadeId("");
    if (escopo === "global") setSecretariaId("");
  }, [escopo]);

  // Quando o tipo muda para logo, sugere perfil institucional
  useEffect(() => {
    if (tipo === "logo") setPerfilId("__institucional__");
  }, [tipo]);

  function toggleDoc(v: TipoDoc) {
    setTiposDoc((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  }

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
        perfil_id: perfilId === "__institucional__" ? null : perfilId,
        obrigatoria,
        ordem,
        tipos_documento: Array.from(tiposDoc),
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Perfil funcional</Label>
              <Select value={perfilId} onValueChange={setPerfilId} disabled={tipo === "logo"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__institucional__">Institucional (sem perfil)</SelectItem>
                  {perfis.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {PERFIL_LABEL[p.codigo] ?? p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Logo/brasão fica sempre como institucional.
              </p>
            </div>
            <div>
              <Label>Ordem no PDF</Label>
              <Input type="number" min={1} value={ordem}
                onChange={(e) => setOrdem(Math.max(1, Number(e.target.value) || 1))} />
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

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">Documentos que esta assinatura atende</Label>
              <span className="text-xs text-muted-foreground">
                {tiposDoc.size === 0 ? "Todos" : `${tiposDoc.size} selecionado(s)`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_DOCUMENTO.map((d) => (
                <label key={d.value} className="flex items-center gap-2 rounded-md p-2 hover:bg-background cursor-pointer">
                  <Checkbox
                    checked={tiposDoc.has(d.value)}
                    onCheckedChange={() => toggleDoc(d.value)}
                  />
                  <span className="text-sm">{d.label}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Deixe em branco para atender a todos os tipos de documento.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Assinatura obrigatória</div>
              <div className="text-xs text-muted-foreground">
                Se marcada e ausente, o PDF não será gerado.
              </div>
            </div>
            <Switch checked={obrigatoria} onCheckedChange={setObrigatoria} />
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

/* ============================================================
 * Aba de Regras por Documento — apenas Master
 * ============================================================ */

type RegraRow = {
  id: string;
  tipo_documento: string;
  secretaria_id: string | null;
  perfil_codigo: string | null;
  tipo_assinatura: Tipo;
  ordem: number;
  obrigatoria: boolean;
  ativa: boolean;
  observacao: string | null;
};

function RegrasTab() {
  const qc = useQueryClient();
  const askConfirm = useConfirm();
  const [tab, setTab] = useState<TipoDoc>("frequencia");
  const [openForm, setOpenForm] = useState(false);

  const { data: secretarias } = useQuery({
    queryKey: ["secretarias-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("secretarias")
        .select("id, nome").is("deleted_at", null).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: regras, isLoading } = useQuery({
    queryKey: ["assinatura-regras", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinatura_documento_regras")
        .select("*, secretarias:secretaria_id(nome)")
        .eq("tipo_documento", tab)
        .order("secretaria_id", { ascending: true, nullsFirst: true })
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (RegraRow & { secretarias: { nome: string } | null })[];
    },
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase.from("assinatura_documento_regras")
        .update({ ativa }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinatura-regras"] });
      toast.success("Regra atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assinatura_documento_regras").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assinatura-regras"] });
      toast.success("Regra removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TipoDoc)}>
          <TabsList>
            {TIPOS_DOCUMENTO.map((d) => (
              <TabsTrigger key={d.value} value={d.value}>{d.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button onClick={() => setOpenForm(true)}>
          <Plus className="mr-1 h-4 w-4" />Nova regra
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !regras?.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma regra cadastrada para este tipo de documento.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="text-left">
                <th className="p-3">Ordem</th>
                <th className="p-3">Perfil / Tipo</th>
                <th className="p-3">Escopo</th>
                <th className="p-3">Obrigatória</th>
                <th className="p-3">Ativa</th>
                <th className="p-3">Observação</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {regras.map((r) => {
                const escopo = r.secretarias?.nome ? `Secretaria · ${r.secretarias.nome}` : "Global (padrão)";
                const label = r.perfil_codigo
                  ? `${PERFIL_LABEL[r.perfil_codigo] ?? r.perfil_codigo} — ${TIPO_LABEL[r.tipo_assinatura]}`
                  : `Institucional — ${TIPO_LABEL[r.tipo_assinatura]}`;
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="p-3 tabular-nums">{r.ordem}</td>
                    <td className="p-3">
                      <Badge variant={r.perfil_codigo ? "secondary" : "outline"}>{label}</Badge>
                    </td>
                    <td className="p-3">{escopo}</td>
                    <td className="p-3">
                      {r.obrigatoria ? <Badge>Obrigatória</Badge> : <Badge variant="outline">Opcional</Badge>}
                    </td>
                    <td className="p-3">
                      <Badge variant={r.ativa ? "default" : "outline"}>{r.ativa ? "Ativa" : "Inativa"}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{r.observacao ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button size="sm" variant="outline"
                          onClick={() => toggleAtiva.mutate({ id: r.id, ativa: !r.ativa })}>
                          {r.ativa ? "Inativar" : "Ativar"}
                        </Button>
                        <Button size="sm" variant="ghost"
                          onClick={() => {
                            void (async () => {
                              const ok = await askConfirm({
                                title: "Remover esta regra?",
                                tone: "destructive",
                                confirmLabel: "Remover",
                              });
                              if (ok) remove.mutate(r.id);
                            })();
                          }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
        <NovaRegraDialog
          tipoDocumento={tab}
          secretarias={secretarias ?? []}
          onClose={() => setOpenForm(false)}
          onSaved={() => {
            setOpenForm(false);
            qc.invalidateQueries({ queryKey: ["assinatura-regras"] });
          }}
        />
      )}
    </div>
  );
}

function NovaRegraDialog({
  tipoDocumento, secretarias, onClose, onSaved,
}: {
  tipoDocumento: TipoDoc;
  secretarias: LookupSec[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [alcance, setAlcance] = useState<"global" | "secretaria">("global");
  const [secretariaId, setSecretariaId] = useState("");
  const [perfilCodigo, setPerfilCodigo] = useState<string>("GESTOR");
  const [tipoAssinatura, setTipoAssinatura] = useState<Tipo>("assinatura");
  const [ordem, setOrdem] = useState<number>(1);
  const [obrigatoria, setObrigatoria] = useState(true);
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (alcance === "secretaria" && !secretariaId) {
      toast.error("Selecione a secretaria"); return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("assinatura_documento_regras").insert({
        tipo_documento: tipoDocumento,
        secretaria_id: alcance === "secretaria" ? secretariaId : null,
        perfil_codigo: perfilCodigo === "__institucional__" ? null : perfilCodigo,
        tipo_assinatura: tipoAssinatura,
        ordem,
        obrigatoria,
        observacao: observacao.trim() || null,
        ativa: true,
      });
      if (error) throw error;
      toast.success("Regra cadastrada");
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
          <DialogTitle>Nova regra</DialogTitle>
          <DialogDescription>
            Define quem assina o documento <strong>{TIPOS_DOCUMENTO.find((d) => d.value === tipoDocumento)?.label}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Alcance</Label>
              <Select value={alcance} onValueChange={(v) => setAlcance(v as typeof alcance)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (padrão)</SelectItem>
                  <SelectItem value="secretaria">Secretaria específica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ordem no PDF</Label>
              <Input type="number" min={1} value={ordem}
                onChange={(e) => setOrdem(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          </div>

          {alcance === "secretaria" && (
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Perfil</Label>
              <Select value={perfilCodigo} onValueChange={setPerfilCodigo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__institucional__">Institucional (sem perfil)</SelectItem>
                  {PERFIS_ASSINANTES.map((c) => (
                    <SelectItem key={c} value={c}>{PERFIL_LABEL[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={tipoAssinatura} onValueChange={(v) => setTipoAssinatura(v as Tipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                  <SelectItem value="carimbo">Carimbo</SelectItem>
                  <SelectItem value="logo">Logo / Brasão</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium">Assinatura obrigatória</div>
              <div className="text-xs text-muted-foreground">
                Se marcada e ausente, o PDF não será gerado.
              </div>
            </div>
            <Switch checked={obrigatoria} onCheckedChange={setObrigatoria} />
          </div>

          <div>
            <Label>Observação</Label>
            <Input value={observacao} onChange={(e) => setObservacao(e.target.value)}
              placeholder="Opcional — descreve o papel/uso" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={salvar}>{saving ? "Salvando..." : "Salvar regra"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
