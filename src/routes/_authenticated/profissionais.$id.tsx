import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileBarChart } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import {
  PageHeader,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "@/components/shared";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/profissionais/$id")({
  component: ProfissionalDetailPage,
});

type TipoEvento = Database["public"]["Enums"]["tipo_evento_funcional"];
type StatusPend = Database["public"]["Enums"]["status_pendencia_freq"];

const EVENTO_LABEL: Record<TipoEvento, string> = {
  admissao: "Admissão",
  transferencia: "Transferência",
  promocao: "Promoção",
  mudanca_cargo: "Mudança de cargo",
  mudanca_funcao: "Mudança de função",
  mudanca_vinculo: "Mudança de vínculo",
  afastamento: "Afastamento",
  retorno: "Retorno",
  ferias: "Férias",
  licenca: "Licença",
  desligamento: "Desligamento",
  outro: "Outro",
};

const MES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type FormState = {
  tipo_evento: TipoEvento;
  data_inicio: string;
  data_fim: string;
  motivo: string;
  documento_referencia: string;
  observacoes: string;
};

const EMPTY: FormState = {
  tipo_evento: "outro",
  data_inicio: new Date().toISOString().slice(0, 10),
  data_fim: "",
  motivo: "",
  documento_referencia: "",
  observacoes: "",
};

function fmtDate(v?: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleDateString("pt-BR");
}
function fmtNum(v?: number | null) {
  return Number(v ?? 0).toLocaleString("pt-BR");
}
function fmtCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function ProfissionalDetailPage() {
  const { id } = Route.useParams();
  const [tab, setTab] = useState<string>("dados");

  const { data: profissional, isLoading: loadingProf } = useQuery({
    queryKey: ["profissional-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select(
          `id, nome_completo, nome_social, cpf, matricula, email, telefone,
           data_nascimento, sexo, data_admissao, carga_horaria_semanal, status,
           observacoes, banco, agencia, conta_corrente, proj, h_p, c_h, jorn,
           secretaria:secretarias(nome, sigla),
           unidade:unidades(id, nome, sigla),
           setor:setores(id, nome),
           cargo:cargos(nome),
           funcao:funcoes(nome),
           vinculo:vinculos(nome, natureza)`,
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/profissionais">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Link>
      </Button>

      <PageHeader
        title={profissional?.nome_completo ?? (loadingProf ? "Carregando…" : "Profissional")}
        description={[
          profissional?.matricula && `Mat.: ${profissional.matricula}`,
          profissional?.cpf && `CPF: ${fmtCPF(profissional.cpf)}`,
          profissional?.cargo?.nome && `Cargo: ${profissional.cargo.nome}`,
          profissional?.vinculo?.nome && `Vínculo: ${profissional.vinculo.nome}`,
        ]
          .filter(Boolean)
          .join(" · ") || undefined}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Dados Gerais</TabsTrigger>
          <TabsTrigger value="lotacao">Lotação</TabsTrigger>
          <TabsTrigger value="frequencias">Frequências</TabsTrigger>
          <TabsTrigger value="competencias">Competências</TabsTrigger>
          <TabsTrigger value="horas">Horas Extras</TabsTrigger>
          <TabsTrigger value="pendencias">Pendências</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <DadosGeraisTab profissional={profissional} loading={loadingProf} />
        </TabsContent>
        <TabsContent value="lotacao" className="mt-4">
          <LotacaoTab profissional={profissional} />
        </TabsContent>
        <TabsContent value="frequencias" className="mt-4">
          <FrequenciasTab profissionalId={id} />
        </TabsContent>
        <TabsContent value="competencias" className="mt-4">
          <CompetenciasTab profissionalId={id} />
        </TabsContent>
        <TabsContent value="horas" className="mt-4">
          <HorasExtrasTab profissionalId={id} />
        </TabsContent>
        <TabsContent value="pendencias" className="mt-4">
          <PendenciasTab profissionalId={id} />
        </TabsContent>
        <TabsContent value="relatorios" className="mt-4">
          <RelatoriosTab profissionalId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================= Dados Gerais ============================= */

type ProfDetail = NonNullable<Awaited<ReturnType<typeof loadNever>>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function loadNever() {
  return null as unknown as {
    id: string;
    nome_completo: string;
    nome_social: string | null;
    cpf: string;
    matricula: string | null;
    email: string | null;
    telefone: string | null;
    data_nascimento: string | null;
    sexo: string | null;
    data_admissao: string | null;
    carga_horaria_semanal: number | null;
    status: string;
    observacoes: string | null;
    banco: string | null;
    agencia: string | null;
    conta_corrente: string | null;
    proj: number | null;
    h_p: number | null;
    c_h: number | null;
    jorn: number | null;
    secretaria: { nome: string; sigla: string | null } | null;
    unidade: { id: string; nome: string; sigla: string | null } | null;
    setor: { id: string; nome: string } | null;
    cargo: { nome: string } | null;
    funcao: { nome: string } | null;
    vinculo: { nome: string; natureza: string | null } | null;
  };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm">{value || "-"}</div>
    </div>
  );
}

function DadosGeraisTab({
  profissional,
  loading,
}: {
  profissional: ProfDetail | null | undefined;
  loading: boolean;
}) {
  if (loading) return <Card className="p-6 text-sm text-muted-foreground">Carregando…</Card>;
  if (!profissional) return <EmptyState title="Profissional não encontrado" />;
  const p = profissional;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Identificação</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome" value={p.nome_completo} />
          <Field label="Nome social" value={p.nome_social} />
          <Field label="CPF" value={p.cpf ? fmtCPF(p.cpf) : "-"} />
          <Field label="Matrícula" value={p.matricula} />
          <Field label="Data nasc." value={fmtDate(p.data_nascimento)} />
          <Field label="Sexo" value={p.sexo} />
          <Field label="Status" value={<Badge variant="secondary">{p.status}</Badge>} />
          <Field label="Admissão" value={fmtDate(p.data_admissao)} />
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Contato</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail" value={p.email} />
          <Field label="Telefone" value={p.telefone} />
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Vínculo funcional</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cargo" value={p.cargo?.nome} />
          <Field label="Função" value={p.funcao?.nome} />
          <Field label="Vínculo" value={p.vinculo?.nome} />
          <Field label="Natureza" value={p.vinculo?.natureza} />
          <Field label="CH semanal" value={p.carga_horaria_semanal} />
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Financeiro (Ágili)</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco" value={p.banco} />
          <Field label="Agência" value={p.agencia} />
          <Field label="Conta" value={p.conta_corrente} />
          <Field label="Proj" value={p.proj} />
          <Field label="H.P" value={p.h_p} />
          <Field label="C.H" value={p.c_h} />
          <Field label="Jorn" value={p.jorn} />
        </div>
      </Card>
      {p.observacoes && (
        <Card className="p-4 md:col-span-2">
          <h3 className="mb-2 text-sm font-semibold">Observações</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.observacoes}</p>
        </Card>
      )}
    </div>
  );
}

/* =============================== Lotação ================================ */

function LotacaoTab({ profissional }: { profissional: ProfDetail | null | undefined }) {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canManage = has("historico.gerenciar");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: eventos, isLoading } = useQuery({
    queryKey: ["historico", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissional_historico_funcional")
        .select("*")
        .eq("profissional_id", id)
        .is("deleted_at", null)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.data_inicio) throw new Error("Data de início é obrigatória");
      const { error } = await supabase.from("profissional_historico_funcional").insert({
        profissional_id: id,
        tipo_evento: f.tipo_evento,
        data_inicio: f.data_inicio,
        data_fim: f.data_fim || null,
        motivo: f.motivo.trim() || null,
        documento_referencia: f.documento_referencia.trim() || null,
        observacoes: f.observacoes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento registrado");
      setOpen(false);
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["historico", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (eventoId: string) => {
      const { error } = await supabase
        .from("profissional_historico_funcional")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", eventoId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["historico", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Lotação atual</h3>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Field label="Secretaria" value={profissional?.secretaria?.nome} />
          <Field
            label="Unidade"
            value={
              profissional?.unidade
                ? profissional.unidade.sigla ?? profissional.unidade.nome
                : "-"
            }
          />
          <Field label="Setor" value={profissional?.setor?.nome} />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Histórico funcional</h3>
        {canManage && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> Novo evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Tipo de evento *</Label>
                  <Select
                    value={form.tipo_evento}
                    onValueChange={(v: TipoEvento) => setForm({ ...form, tipo_evento: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EVENTO_LABEL) as TipoEvento[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {EVENTO_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Data de início *</Label>
                    <Input
                      type="date"
                      value={form.data_inicio}
                      onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Data de fim</Label>
                    <Input
                      type="date"
                      value={form.data_fim}
                      onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input
                    value={form.motivo}
                    onChange={(e) => setForm({ ...form, motivo: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Documento de referência</Label>
                  <Input
                    value={form.documento_referencia}
                    onChange={(e) => setForm({ ...form, documento_referencia: e.target.value })}
                    placeholder="Portaria nº..."
                  />
                </div>
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    rows={2}
                    value={form.observacoes}
                    onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => create.mutate(form)} disabled={create.isPending}>
                  {create.isPending ? "Salvando..." : "Registrar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : !eventos?.length ? (
          <EmptyState title="Nenhum evento registrado" />
        ) : (
          <ol className="divide-y">
            {eventos.map((ev) => (
              <li key={ev.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{EVENTO_LABEL[ev.tipo_evento as TipoEvento]}</Badge>
                      <span className="text-sm font-medium">
                        {fmtDate(ev.data_inicio)}
                        {ev.data_fim ? ` → ${fmtDate(ev.data_fim)}` : ""}
                      </span>
                    </div>
                    {ev.motivo && <p className="mt-1 text-sm">{ev.motivo}</p>}
                    {ev.documento_referencia && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ref.: {ev.documento_referencia}
                      </p>
                    )}
                    {ev.observacoes && (
                      <p className="mt-1 text-xs text-muted-foreground">{ev.observacoes}</p>
                    )}
                  </div>
                  {canManage && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Remover este evento?")) remove.mutate(ev.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

/* ==================== Query compartilhada de frequências ==================== */

type LinhaFreq = {
  id: string;
  status_linha: string;
  faltas_justificadas: number | null;
  faltas_injustificadas: number | null;
  atestado: number | null;
  he_50: number | null;
  he_100: number | null;
  adicional_noturno: number | null;
  plantoes_extras: number | null;
  sobreaviso: number | null;
  incentivo: number | null;
  ferias: number | null;
  licenca_premio: number | null;
  horas_extras: number | null;
  frequencias: {
    id: string;
    tipo: string;
    status: string;
    competencia_unidades: {
      unidade_id: string;
      unidades: { id: string; nome: string; sigla: string | null } | null;
      competencias: { id: string; ano: number; mes: number } | null;
    } | null;
  } | null;
};

function useLinhasFrequencia(profissionalId: string) {
  return useQuery({
    queryKey: ["prof-detail-linhas", profissionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select(
          `id, status_linha, faltas_justificadas, faltas_injustificadas, atestado,
           he_50, he_100, adicional_noturno, plantoes_extras, sobreaviso, incentivo,
           ferias, licenca_premio, horas_extras,
           frequencias!inner(
             id, tipo, status,
             competencia_unidades!inner(
               unidade_id,
               unidades!inner(id, nome, sigla),
               competencias!inner(id, ano, mes)
             )
           )`,
        )
        .is("deleted_at", null)
        .eq("profissional_id", profissionalId)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaFreq[];
    },
  });
}

function labelComp(c: { ano: number; mes: number } | null | undefined) {
  if (!c) return "-";
  return `${MES_LABEL[c.mes - 1]}/${c.ano}`;
}

/* ============================== Frequências ============================== */

function FrequenciasTab({ profissionalId }: { profissionalId: string }) {
  const { data: rows, isLoading } = useLinhasFrequencia(profissionalId);
  const list = useMemo(
    () =>
      (rows ?? []).slice().sort((a, b) => {
        const ca = a.frequencias?.competencia_unidades?.competencias;
        const cb = b.frequencias?.competencia_unidades?.competencias;
        if (!ca || !cb) return 0;
        return cb.ano * 12 + cb.mes - (ca.ano * 12 + ca.mes);
      }),
    [rows],
  );

  const columns: DataTableColumn<LinhaFreq>[] = [
    {
      key: "comp",
      header: "Competência",
      cell: (r) => labelComp(r.frequencias?.competencia_unidades?.competencias),
    },
    { key: "tipo", header: "Tipo", cell: (r) => r.frequencias?.tipo ?? "-" },
    {
      key: "unidade",
      header: "Unidade",
      cell: (r) =>
        r.frequencias?.competencia_unidades?.unidades?.sigla ??
        r.frequencias?.competencia_unidades?.unidades?.nome ??
        "-",
    },
    {
      key: "status",
      header: "Status linha",
      cell: (r) => <Badge variant="secondary">{r.status_linha}</Badge>,
    },
    { key: "faltas", header: "Faltas", cell: (r) => fmtNum(r.faltas_injustificadas) },
    { key: "atest", header: "Atestado", cell: (r) => fmtNum(r.atestado) },
    {
      key: "he",
      header: "HE (50+100)",
      cell: (r) => fmtNum(Number(r.he_50 ?? 0) + Number(r.he_100 ?? 0)),
    },
  ];

  return (
    <DataTable<LinhaFreq>
      columns={columns}
      rows={list}
      getRowKey={(r) => r.id}
      loading={isLoading}
      emptyTitle="Sem lançamentos de frequência"
      emptyDescription="Este profissional ainda não aparece em nenhuma folha."
    />
  );
}

/* ============================= Competências ============================= */

function CompetenciasTab({ profissionalId }: { profissionalId: string }) {
  const { data: rows, isLoading } = useLinhasFrequencia(profissionalId);

  type CompAgg = {
    key: string;
    ano: number;
    mes: number;
    folhas: number;
    aprovadas: number;
    pendentes: number;
  };
  const list = useMemo<CompAgg[]>(() => {
    const map = new Map<string, CompAgg>();
    for (const r of rows ?? []) {
      const c = r.frequencias?.competencia_unidades?.competencias;
      if (!c) continue;
      const key = `${c.ano}-${c.mes}`;
      const cur =
        map.get(key) ?? { key, ano: c.ano, mes: c.mes, folhas: 0, aprovadas: 0, pendentes: 0 };
      cur.folhas += 1;
      if (r.status_linha === "aprovada") cur.aprovadas += 1;
      if (r.status_linha === "pendente") cur.pendentes += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes),
    );
  }, [rows]);

  const columns: DataTableColumn<CompAgg>[] = [
    { key: "comp", header: "Competência", cell: (r) => `${MES_LABEL[r.mes - 1]}/${r.ano}` },
    { key: "folhas", header: "Folhas", cell: (r) => r.folhas },
    { key: "aprov", header: "Aprovadas", cell: (r) => r.aprovadas },
    { key: "pend", header: "Pendentes", cell: (r) => r.pendentes },
  ];

  return (
    <DataTable<CompAgg>
      columns={columns}
      rows={list}
      getRowKey={(r) => r.key}
      loading={isLoading}
      emptyTitle="Nenhuma competência com lançamentos"
    />
  );
}

/* ============================== Horas Extras ============================= */

function HorasExtrasTab({ profissionalId }: { profissionalId: string }) {
  const { data: rows, isLoading } = useLinhasFrequencia(profissionalId);

  type HeAgg = {
    key: string;
    ano: number;
    mes: number;
    he_50: number;
    he_100: number;
    adn: number;
    plantoes: number;
    sobreaviso: number;
    total: number;
  };
  const list = useMemo<HeAgg[]>(() => {
    const map = new Map<string, HeAgg>();
    for (const r of rows ?? []) {
      const c = r.frequencias?.competencia_unidades?.competencias;
      if (!c) continue;
      const key = `${c.ano}-${c.mes}`;
      const cur =
        map.get(key) ??
        {
          key, ano: c.ano, mes: c.mes,
          he_50: 0, he_100: 0, adn: 0, plantoes: 0, sobreaviso: 0, total: 0,
        };
      const he50 = Number(r.he_50 ?? 0);
      const he100 = Number(r.he_100 ?? 0);
      cur.he_50 += he50;
      cur.he_100 += he100;
      cur.adn += Number(r.adicional_noturno ?? 0);
      cur.plantoes += Number(r.plantoes_extras ?? 0);
      cur.sobreaviso += Number(r.sobreaviso ?? 0);
      cur.total += he50 + he100;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.ano * 12 + b.mes - (a.ano * 12 + a.mes),
    );
  }, [rows]);

  const columns: DataTableColumn<HeAgg>[] = [
    { key: "comp", header: "Competência", cell: (r) => `${MES_LABEL[r.mes - 1]}/${r.ano}` },
    { key: "he50", header: "HE 50%", cell: (r) => fmtNum(r.he_50) },
    { key: "he100", header: "HE 100%", cell: (r) => fmtNum(r.he_100) },
    { key: "adn", header: "Adic. noturno", cell: (r) => fmtNum(r.adn) },
    { key: "plan", header: "Plantões", cell: (r) => fmtNum(r.plantoes) },
    { key: "sob", header: "Sobreaviso", cell: (r) => fmtNum(r.sobreaviso) },
    { key: "total", header: "Total HE", cell: (r) => fmtNum(r.total) },
  ];

  return (
    <DataTable<HeAgg>
      columns={columns}
      rows={list}
      getRowKey={(r) => r.key}
      loading={isLoading}
      emptyTitle="Sem horas extras registradas"
    />
  );
}

/* ============================== Pendências ============================== */

type PendRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  status: StatusPend;
  created_at: string;
  data_resposta: string | null;
  data_resolucao: string | null;
  frequencia_profissional: {
    frequencias: {
      competencia_unidades: {
        competencias: { ano: number; mes: number } | null;
      } | null;
    } | null;
  } | null;
};

function PendenciasTab({ profissionalId }: { profissionalId: string }) {
  const { data: pends, isLoading } = useQuery({
    queryKey: ["prof-detail-pendencias", profissionalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_pendencias")
        .select(
          `id, titulo, descricao, status, created_at, data_resposta, data_resolucao,
           frequencia_profissional!inner(
             profissional_id,
             frequencias!inner(
               competencia_unidades!inner(
                 competencias!inner(ano, mes)
               )
             )
           )`,
        )
        .is("deleted_at", null)
        .eq("frequencia_profissional.profissional_id", profissionalId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as PendRow[];
    },
  });

  const columns: DataTableColumn<PendRow>[] = [
    {
      key: "comp",
      header: "Competência",
      cell: (r) =>
        labelComp(r.frequencia_profissional?.frequencias?.competencia_unidades?.competencias),
    },
    { key: "titulo", header: "Título", cell: (r) => <span className="font-medium">{r.titulo}</span> },
    {
      key: "descricao",
      header: "Descrição",
      cell: (r) => (
        <span className="line-clamp-2 text-xs text-muted-foreground">{r.descricao ?? "-"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant="secondary">{r.status}</Badge>,
    },
    { key: "criada", header: "Aberta em", cell: (r) => fmtDate(r.created_at) },
  ];

  return (
    <DataTable<PendRow>
      columns={columns}
      rows={pends ?? []}
      getRowKey={(r) => r.id}
      loading={isLoading}
      emptyTitle="Nenhuma pendência"
      emptyDescription="Este profissional não tem pendências de frequência abertas ou históricas."
    />
  );
}

/* ============================== Relatórios ============================== */

function RelatoriosTab({ profissionalId }: { profissionalId: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <FileBarChart className="mt-1 h-5 w-5 text-muted-foreground" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">Relatórios do profissional</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Abre a tela de <strong>Relatórios por Profissional</strong> já com este
            profissional pré-selecionado. Escolha ali as competências (de/até) e
            exporte em PDF ou Excel.
          </p>
          <div className="mt-3">
            <Button asChild size="sm">
              <Link
                to="/relatorios-profissional"
                search={{ profissionalId }}
              >
                Abrir relatórios
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}