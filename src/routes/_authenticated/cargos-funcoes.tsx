import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, Power, Briefcase } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/cargos-funcoes")({
  component: CargosFuncoesPage,
});

type Cargo = {
  id: string;
  nome: string;
  codigo: string | null;
  cbo: string | null;
  nivel: "fundamental" | "medio" | "tecnico" | "superior" | "pos_graduacao" | null;
  area_profissional: string | null;
  exige_conselho: boolean;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
};

type Funcao = {
  id: string;
  nome: string;
  codigo: string | null;
  gratificacao_percentual: number | null;
  cargo_id: string | null;
  cargo?: { nome: string } | null;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
};

const NIVEIS = [
  { v: "fundamental", l: "Fundamental" },
  { v: "medio", l: "Médio" },
  { v: "tecnico", l: "Técnico" },
  { v: "superior", l: "Superior" },
  { v: "pos_graduacao", l: "Pós-graduação" },
] as const;

function CargosFuncoesPage() {
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;
  const nav = useNavigate();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [tab, setTab] = useState<"cargos" | "funcoes">(hash === "funcoes" ? "funcoes" : "cargos");
  useEffect(() => {
    if (hash === "funcoes" && tab !== "funcoes") setTab("funcoes");
    else if (hash === "cargos" && tab !== "cargos") setTab("cargos");
  }, [hash, tab]);
  const changeTab = (v: string) => {
    const next = v === "funcoes" ? "funcoes" : "cargos";
    setTab(next);
    nav({ to: "/cargos-funcoes", hash: next, replace: true });
  };

  if (userLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!isMaster) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Apenas usuários Master podem gerenciar cargos e funções.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Cargos e Funções</h1>
          <p className="text-sm text-muted-foreground">
            Base utilizada no cadastro de profissionais. Itens em uso não podem ser excluídos — apenas inativados.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList>
          <TabsTrigger value="cargos">Cargos</TabsTrigger>
          <TabsTrigger value="funcoes">Funções</TabsTrigger>
        </TabsList>
        <TabsContent value="cargos" className="mt-4">
          <CargosTab />
        </TabsContent>
        <TabsContent value="funcoes" className="mt-4">
          <FuncoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CargosTab() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cargo | null>(null);
  const [form, setForm] = useState<{
    nome: string;
    codigo: string;
    cbo: string;
    nivel: Cargo["nivel"];
    area_profissional: string;
    exige_conselho: boolean;
  }>({
    nome: "",
    codigo: "",
    cbo: "",
    nivel: null,
    area_profissional: "",
    exige_conselho: false,
  });

  const { data: cargos = [], isLoading } = useQuery({
    queryKey: ["cargos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome, codigo, cbo, nivel, area_profissional, exige_conselho, status")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Cargo[];
    },
  });

  const { data: uso = {} } = useQuery({
    queryKey: ["cargos-uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("cargo_id")
        .is("deleted_at", null)
        .not("cargo_id", "is", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = (r as { cargo_id: string | null }).cargo_id;
        if (k) map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const nomeT = form.nome.trim();
      if (!nomeT) throw new Error("Informe o nome");
      const payload = {
        nome: nomeT,
        codigo: form.codigo.trim() || null,
        cbo: form.cbo.trim() || null,
        nivel: form.nivel,
        area_profissional: form.area_profissional.trim() || null,
        exige_conselho: form.exige_conselho,
      };
      if (editing) {
        const { error } = await supabase.from("cargos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cargos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cargo atualizado" : "Cargo criado");
      setOpen(false);
      setEditing(null);
      setForm({ nome: "", codigo: "", cbo: "", nivel: null, area_profissional: "", exige_conselho: false });
      qc.invalidateQueries({ queryKey: ["cargos-admin"] });
      qc.invalidateQueries({ queryKey: ["cargos-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (c: Cargo) => {
      const novo = c.status === "ativa" ? "inativa" : "ativa";
      const { error } = await supabase.from("cargos").update({ status: novo }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["cargos-admin"] });
      qc.invalidateQueries({ queryKey: ["cargos-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", codigo: "", cbo: "", nivel: null, area_profissional: "", exige_conselho: false });
    setOpen(true);
  };

  const abrirEdit = (c: Cargo) => {
    setEditing(c);
    setForm({
      nome: c.nome,
      codigo: c.codigo ?? "",
      cbo: c.cbo ?? "",
      nivel: c.nivel,
      area_profissional: c.area_profissional ?? "",
      exige_conselho: !!c.exige_conselho,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" /> Novo cargo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar cargo" : "Novo cargo"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
                </div>
                <div>
                  <Label>CBO</Label>
                  <Input value={form.cbo} onChange={(e) => setForm({ ...form, cbo: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Nível</Label>
                <Select
                  value={form.nivel ?? undefined}
                  onValueChange={(v) => setForm({ ...form, nivel: v as Cargo["nivel"] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIVEIS.map((n) => (
                      <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Área profissional</Label>
                <Input
                  value={form.area_profissional}
                  onChange={(e) => setForm({ ...form, area_profissional: e.target.value })}
                  placeholder="Ex.: Saúde, Administração, Educação..."
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.exige_conselho}
                  onCheckedChange={(v) => setForm({ ...form, exige_conselho: v === true })}
                />
                Exige registro em conselho profissional
                <span className="text-xs text-muted-foreground">
                  (o tipo/número do conselho é preenchido no cadastro do profissional)
                </span>
              </label>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : cargos.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum cargo cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Código</th>
                <th className="p-3">CBO</th>
                <th className="p-3">Nível</th>
                <th className="p-3">Área</th>
                <th className="p-3">Conselho</th>
                <th className="p-3">Em uso</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => {
                const usoCount = uso[c.id] ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="border-t cursor-pointer transition hover:bg-accent/40"
                    onClick={() => nav({ to: "/cargos/$id", params: { id: c.id } })}
                  >
                    <td className="p-3 font-medium">{c.nome}</td>
                    <td className="p-3 text-muted-foreground">{c.codigo ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.cbo ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.nivel ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c.area_profissional ?? "—"}</td>
                    <td className="p-3">
                      {c.exige_conselho ? <Badge variant="secondary">Sim</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      {usoCount > 0 ? <Badge variant="secondary">{usoCount}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant={c.status === "ativa" ? "default" : "outline"}>{c.status}</Badge>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMut.mutate(c)}
                          title={c.status === "ativa" ? "Inativar" : "Ativar"}
                        >
                          {c.status === "ativa" ? (
                            <PowerOff className="h-4 w-4 text-destructive" />
                          ) : (
                            <Power className="h-4 w-4 text-primary" />
                          )}
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
    </div>
  );
}

function FuncoesTab() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Funcao | null>(null);
  const [form, setForm] = useState<{ nome: string; codigo: string; gratificacao: string; cargo_id: string | null }>({
    nome: "",
    codigo: "",
    gratificacao: "",
    cargo_id: null,
  });

  const { data: cargosAtivos = [] } = useQuery({
    queryKey: ["cargos-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargos")
        .select("id, nome")
        .is("deleted_at", null)
        .eq("status", "ativa")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
  });

  const { data: funcoes = [], isLoading } = useQuery({
    queryKey: ["funcoes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funcoes")
        .select("id, nome, codigo, gratificacao_percentual, cargo_id, status, cargo:cargos(nome)")
        .is("deleted_at", null)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Funcao[];
    },
  });

  const { data: uso = {} } = useQuery({
    queryKey: ["funcoes-uso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("funcao_id")
        .is("deleted_at", null)
        .not("funcao_id", "is", null);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const k = (r as { funcao_id: string | null }).funcao_id;
        if (k) map[k] = (map[k] ?? 0) + 1;
      }
      return map;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const nomeT = form.nome.trim();
      if (!nomeT) throw new Error("Informe o nome");
      const grat = form.gratificacao.trim() === "" ? null : Number(form.gratificacao);
      if (grat !== null && (isNaN(grat) || grat < 0 || grat > 500))
        throw new Error("Percentual inválido");
      const payload = {
        nome: nomeT,
        codigo: form.codigo.trim() || null,
        gratificacao_percentual: grat,
        cargo_id: form.cargo_id,
      };
      if (editing) {
        const { error } = await supabase.from("funcoes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("funcoes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Função atualizada" : "Função criada");
      setOpen(false);
      setEditing(null);
      setForm({ nome: "", codigo: "", gratificacao: "", cargo_id: null });
      qc.invalidateQueries({ queryKey: ["funcoes-admin"] });
      qc.invalidateQueries({ queryKey: ["funcoes-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: async (f: Funcao) => {
      const novo = f.status === "ativa" ? "inativa" : "ativa";
      const { error } = await supabase.from("funcoes").update({ status: novo }).eq("id", f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["funcoes-admin"] });
      qc.invalidateQueries({ queryKey: ["funcoes-select"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const abrirNovo = () => {
    setEditing(null);
    setForm({ nome: "", codigo: "", gratificacao: "", cargo_id: null });
    setOpen(true);
  };

  const abrirEdit = (f: Funcao) => {
    setEditing(f);
    setForm({
      nome: f.nome,
      codigo: f.codigo ?? "",
      gratificacao: f.gratificacao_percentual !== null ? String(f.gratificacao_percentual) : "",
      cargo_id: f.cargo_id ?? null,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={abrirNovo}>
              <Plus className="mr-1 h-4 w-4" /> Nova função
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar função" : "Nova função"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
                </div>
                <div>
                  <Label>% Gratificação</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.gratificacao}
                    onChange={(e) => setForm({ ...form, gratificacao: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Cargo relacionado</Label>
                <Select
                  value={form.cargo_id ?? "__none__"}
                  onValueChange={(v) => setForm({ ...form, cargo_id: v === "__none__" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem vínculo</SelectItem>
                    {cargosAtivos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
        ) : funcoes.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhuma função cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Código</th>
                <th className="p-3">Cargo</th>
                <th className="p-3">% Gratificação</th>
                <th className="p-3">Em uso</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {funcoes.map((f) => {
                const usoCount = uso[f.id] ?? 0;
                return (
                  <tr
                    key={f.id}
                    className="border-t cursor-pointer transition hover:bg-accent/40"
                    onClick={() => nav({ to: "/funcoes/$id", params: { id: f.id } })}
                  >
                    <td className="p-3 font-medium">{f.nome}</td>
                    <td className="p-3 text-muted-foreground">{f.codigo ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{f.cargo?.nome ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {f.gratificacao_percentual !== null ? `${f.gratificacao_percentual}%` : "—"}
                    </td>
                    <td className="p-3">
                      {usoCount > 0 ? <Badge variant="secondary">{usoCount}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      <Badge variant={f.status === "ativa" ? "default" : "outline"}>{f.status}</Badge>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => abrirEdit(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleMut.mutate(f)}
                          title={f.status === "ativa" ? "Inativar" : "Ativar"}
                        >
                          {f.status === "ativa" ? (
                            <PowerOff className="h-4 w-4 text-destructive" />
                          ) : (
                            <Power className="h-4 w-4 text-primary" />
                          )}
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
    </div>
  );
}
