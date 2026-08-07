import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/shared/Pagination";
import { PermissionGate } from "@/components/permission-gate";
import { Download, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { IntelligencePanel } from "@/components/relatorios-gerenciais/intelligence-panel";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/auditoria")({ errorComponent: ErrorComponent,
  component: AuditoriaGerencial,
});

type Operacao = "insert" | "update" | "delete" | "login" | "logout" | "custom";

type AuditRow = {
  id: number;
  ocorrido_em: string;
  usuario_id: string | null;
  usuario_email: string | null;
  operacao: Operacao;
  tabela: string;
  registro_id: string | null;
  valor_anterior: unknown;
  valor_novo: unknown;
  ip: string | null;
  user_agent: string | null;
  contexto: unknown;
};

const OP_VARIANT: Record<Operacao, "default" | "secondary" | "destructive" | "outline"> = {
  insert: "secondary",
  update: "default",
  delete: "destructive",
  login: "outline",
  logout: "outline",
  custom: "default",
};
const OP_LABEL: Record<Operacao, string> = {
  insert: "Inserção",
  update: "Atualização",
  delete: "Exclusão",
  login: "Login",
  logout: "Logout",
  custom: "Ação",
};

type Preset = {
  id: string;
  label: string;
  desc: string;
  tabelas?: string[];
  operacoes?: Operacao[];
};

const PRESETS: Preset[] = [
  {
    id: "todos",
    label: "Todos os eventos",
    desc: "Trilha completa (todas as tabelas e operações).",
  },
  {
    id: "cadastros",
    label: "Cadastros gerais",
    desc: "Alterações em Profissionais, Unidades, Setores, Cargos, Funções, Tipos de Unidade.",
    tabelas: [
      "public.profissionais",
      "public.unidades",
      "public.setores",
      "public.cargos",
      "public.funcoes",
      "public.tipos_unidade",
      "public.vinculos",
    ],
  },
  {
    id: "profissionais",
    label: "Profissionais",
    desc: "Somente eventos na tabela profissionais.",
    tabelas: ["public.profissionais", "public.profissional_historico_funcional"],
  },
  {
    id: "usuarios",
    label: "Usuários & Permissões",
    desc: "Criação, alteração e permissões de usuários do sistema.",
    tabelas: [
      "public.usuarios",
      "public.usuario_permissoes",
      "public.usuario_unidades",
      "public.usuario_secretarias",
      "public.perfil_permissoes",
      "public.perfis",
    ],
  },
  {
    id: "sessoes",
    label: "Sessões (login/logout)",
    desc: "Entradas e saídas de usuários.",
    operacoes: ["login", "logout"],
  },
  {
    id: "piso",
    label: "Piso da Enfermagem",
    desc: "Importações, recálculos e alterações no Piso.",
    tabelas: [
      "public.piso_enfermagem",
      "public.piso_mapeamentos_salvos",
      "public.historico_importacoes",
    ],
  },
  {
    id: "frequencias",
    label: "Frequências & Folhas",
    desc: "Alterações em frequências, aprovações e pendências.",
    tabelas: [
      "public.frequencias",
      "public.frequencia_profissional",
      "public.frequencia_aprovacoes",
      "public.frequencia_pendencias",
      "public.frequencias_contratados",
      "public.competencias",
      "public.competencia_unidades",
    ],
  },
  {
    id: "exclusoes",
    label: "Exclusões",
    desc: "Todos os registros deletados no sistema.",
    operacoes: ["delete"],
  },
];

function AuditoriaGerencial() {
  const [preset, setPreset] = useState<string>("cadastros");
  const [operacao, setOperacao] = useState<Operacao | "todas">("todas");
  const [tabela, setTabela] = useState<string>("todas");
  const [usuario, setUsuario] = useState("");
  const [busca, setBusca] = useState("");
  const [dias, setDias] = useState("30");
  const [detalhe, setDetalhe] = useState<AuditRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const cfg = useMemo(() => PRESETS.find((p) => p.id === preset) ?? PRESETS[0], [preset]);

  useEffect(() => {
    setPage(1);
  }, [preset, operacao, tabela, usuario, busca, dias, pageSize]);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(dias));
    return d.toISOString();
  }, [dias]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      "rel-gerenciais-auditoria",
      { preset, operacao, tabela, usuario, busca, desde, page, pageSize },
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .gte("ocorrido_em", desde)
        .order("ocorrido_em", { ascending: false });
      if (cfg.tabelas?.length) q = q.in("tabela", cfg.tabelas);
      if (cfg.operacoes?.length) q = q.in("operacao", cfg.operacoes);
      if (operacao !== "todas") q = q.eq("operacao", operacao);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      if (usuario.trim()) q = q.ilike("usuario_email", `%${usuario.trim()}%`);
      if (busca.trim()) {
        const b = busca.trim();
        q = q.or(`registro_id.ilike.%${b}%,tabela.ilike.%${b}%,usuario_email.ilike.%${b}%`);
      }
      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ["rel-gerenciais-auditoria-kpis", { preset, desde }],
    queryFn: async () => {
      const cnt = async (op?: Operacao) => {
        let q = supabase
          .from("audit_log")
          .select("id", { count: "exact", head: true })
          .gte("ocorrido_em", desde);
        if (cfg.tabelas?.length) q = q.in("tabela", cfg.tabelas);
        if (cfg.operacoes?.length) q = q.in("operacao", cfg.operacoes);
        if (op) q = q.eq("operacao", op);
        const { count } = await q;
        return count ?? 0;
      };
      const [total, ins, upd, del] = await Promise.all([
        cnt(),
        cnt("insert"),
        cnt("update"),
        cnt("delete"),
      ]);
      return { total, ins, upd, del };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  const exportarCsv = async () => {
    if (!total) {
      toast.error("Nada para exportar");
      return;
    }
    let q = supabase
      .from("audit_log")
      .select("*")
      .gte("ocorrido_em", desde)
      .order("ocorrido_em", { ascending: false })
      .limit(5000);
    if (cfg.tabelas?.length) q = q.in("tabela", cfg.tabelas);
    if (cfg.operacoes?.length) q = q.in("operacao", cfg.operacoes);
    if (operacao !== "todas") q = q.eq("operacao", operacao);
    if (tabela !== "todas") q = q.eq("tabela", tabela);
    if (usuario.trim()) q = q.ilike("usuario_email", `%${usuario.trim()}%`);
    if (busca.trim()) {
      const b = busca.trim();
      q = q.or(`registro_id.ilike.%${b}%,tabela.ilike.%${b}%,usuario_email.ilike.%${b}%`);
    }
    const { data: exportRows, error } = await q;
    if (error || !exportRows?.length) {
      toast.error("Falha ao preparar exportação");
      return;
    }
    if (total > 5000)
      toast.warning(`Exportação limitada a 5000 registros (total filtrado: ${total}).`);
    const header = ["ocorrido_em", "operacao", "tabela", "registro_id", "usuario_email", "ip"];
    const csv = [
      "\ufeff" + header.join(";"),
      ...(exportRows as AuditRow[]).map((r) =>
        [
          r.ocorrido_em,
          r.operacao,
          r.tabela,
          r.registro_id ?? "",
          r.usuario_email ?? "",
          r.ip ?? "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${cfg.id}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  async function relatorioAbnt() {
    let q = supabase
      .from("audit_log")
      .select("*")
      .gte("ocorrido_em", desde)
      .order("ocorrido_em", { ascending: false })
      .limit(3000);
    if (cfg.tabelas?.length) q = q.in("tabela", cfg.tabelas);
    if (cfg.operacoes?.length) q = q.in("operacao", cfg.operacoes);
    if (operacao !== "todas") q = q.eq("operacao", operacao);
    if (tabela !== "todas") q = q.eq("tabela", tabela);
    if (usuario.trim()) q = q.ilike("usuario_email", `%${usuario.trim()}%`);
    if (busca.trim()) {
      const b = busca.trim();
      q = q.or(`registro_id.ilike.%${b}%,tabela.ilike.%${b}%,usuario_email.ilike.%${b}%`);
    }
    const { data: linhas, error } = await q;
    if (error) throw error;
    const lista = (linhas ?? []) as AuditRow[];
    const contar = (get: (r: AuditRow) => string | null) => {
      const m = new Map<string, number>();
      for (const r of lista) {
        const k = get(r) || "—";
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Array.from(m, ([label, valor]) => ({ label, valor }));
    };
    return {
      arquivo: `relatorio-auditoria-${cfg.id}`,
      titulo: "Relatório de Trilha de Auditoria",
      subtitulo: `Foco: ${cfg.label} · Últimos ${dias} dias`,
      orientacao: "landscape" as const,
      filtros: [
        { label: "Foco", valor: cfg.label },
        { label: "Período", valor: `Últimos ${dias} dias` },
        { label: "Operação", valor: operacao === "todas" ? "Todas" : operacao },
        { label: "Tabela", valor: tabela === "todas" ? "Todas" : tabela },
        { label: "Usuário", valor: usuario || "Todos" },
        { label: "Busca", valor: busca || "—" },
      ],
      kpis: [
        { label: "Eventos no período", valor: kpis?.total ?? lista.length },
        { label: "Inclusões", valor: kpis?.ins ?? 0 },
        { label: "Alterações", valor: kpis?.upd ?? 0 },
        { label: "Exclusões", valor: kpis?.del ?? 0 },
      ],
      graficos: [
        {
          tipo: "rosca" as const,
          titulo: "2 Eventos por tipo de operação",
          dados: contar((r) => r.operacao),
          limite: 5,
        },
        {
          tipo: "barras" as const,
          titulo: "2.1 Tabelas mais movimentadas",
          dados: contar((r) => r.tabela),
          limite: 10,
        },
        {
          tipo: "barras" as const,
          titulo: "2.2 Usuários com mais ações",
          dados: contar((r) => r.usuario_email),
          limite: 10,
        },
      ],
      colunas: [
        {
          header: "Data/Hora",
          value: (r: AuditRow) => new Date(r.ocorrido_em).toLocaleString("pt-BR"),
        },
        { header: "Operação", value: (r: AuditRow) => r.operacao },
        { header: "Tabela", value: (r: AuditRow) => r.tabela },
        { header: "Registro", value: (r: AuditRow) => r.registro_id },
        { header: "Usuário", value: (r: AuditRow) => r.usuario_email },
        { header: "IP", value: (r: AuditRow) => r.ip },
      ],
      linhas: lista,
      notas: [
        "Trilha de auditoria imutável, registrada automaticamente pelo sistema a cada operação.",
        lista.length >= 3000
          ? "Exportação limitada aos 3.000 eventos mais recentes do filtro aplicado."
          : "Todos os eventos do filtro aplicado estão contemplados neste documento.",
      ],
      assinaturas: ["Controle Interno", "Secretário(a) Municipal de Saúde"],
    };
  }


  return (
    <PermissionGate permission="auditoria.visualizar">
      <div className="space-y-4">
        <IntelligencePanel foco="auditoria" titulo="Auditoria Gerencial" />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Auditoria Gerencial
            </h1>
            <p className="text-sm text-muted-foreground">
              Quem alterou o quê, quando e onde. Escolha um foco abaixo para filtrar a trilha.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <PermissionGate permission="auditoria.exportar" fallback={null}>
              <Button size="sm" variant="outline" onClick={() => void exportarCsv()}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
              <BotaoRelatorioAbnt relatorio={relatorioAbnt} disabled={!total} />
            </PermissionGate>
          </div>

        </div>

        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              onClick={() => {
                setPreset(p.id);
                setOperacao("todas");
                setTabela("todas");
              }}
              title={p.desc}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground -mt-2">{cfg.desc}</p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Eventos no período" value={kpis?.total ?? 0} />
          <Kpi label="Inserções" value={kpis?.ins ?? 0} tone="secondary" />
          <Kpi label="Atualizações" value={kpis?.upd ?? 0} tone="default" />
          <Kpi label="Exclusões" value={kpis?.del ?? 0} tone="destructive" />
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <Input
            placeholder="Buscar registro, tabela ou e-mail…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Input
            placeholder="Filtrar por e-mail do usuário"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
          <Select value={operacao} onValueChange={(v) => setOperacao(v as Operacao | "todas")}>
            <SelectTrigger>
              <SelectValue placeholder="Operação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas operações</SelectItem>
              <SelectItem value="insert">Inserção</SelectItem>
              <SelectItem value="update">Atualização</SelectItem>
              <SelectItem value="delete">Exclusão</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="custom">Ação (cliente)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tabela} onValueChange={setTabela}>
            <SelectTrigger>
              <SelectValue placeholder="Tabela" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas tabelas do foco</SelectItem>
              {(cfg.tabelas ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/^public\./, "")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger>
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Últimas 24h</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Data/Hora</th>
                  <th className="p-3">Operação</th>
                  <th className="p-3">Tabela</th>
                  <th className="p-3">Registro</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Carregando…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Nenhum evento no período/filtro selecionado.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">
                        {new Date(r.ocorrido_em).toLocaleString("pt-BR")}
                      </td>
                      <td className="p-3">
                        <Badge variant={OP_VARIANT[r.operacao]}>{OP_LABEL[r.operacao]}</Badge>
                      </td>
                      <td className="p-3 font-mono text-xs">{r.tabela.replace(/^public\./, "")}</td>
                      <td className="p-3 font-mono text-xs truncate max-w-[220px]">
                        {r.registro_id ?? "—"}
                      </td>
                      <td className="p-3">
                        {r.usuario_email ?? <span className="text-muted-foreground">sistema</span>}
                      </td>
                      <td className="p-3">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Ver detalhe do registro"
                          onClick={() => setDetalhe(r)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={isFetching}
        />

        <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do evento</DialogTitle>
            </DialogHeader>
            {detalhe && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info
                    label="Data/Hora"
                    value={new Date(detalhe.ocorrido_em).toLocaleString("pt-BR")}
                  />
                  <Info label="Operação" value={OP_LABEL[detalhe.operacao]} />
                  <Info label="Tabela" value={detalhe.tabela} mono />
                  <Info label="Registro" value={detalhe.registro_id ?? "—"} mono />
                  <Info label="Usuário" value={detalhe.usuario_email ?? "sistema"} />
                  <Info label="IP" value={detalhe.ip ?? "—"} />
                </div>
                {detalhe.valor_anterior != null && (
                  <JsonBlock title="Valor anterior" data={detalhe.valor_anterior} />
                )}
                {detalhe.valor_novo != null && (
                  <JsonBlock title="Valor novo" data={detalhe.valor_novo} />
                )}
                {detalhe.contexto != null && <JsonBlock title="Contexto" data={detalhe.contexto} />}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "default" | "secondary" | "destructive";
}) {
  const color =
    tone === "destructive"
      ? "text-destructive"
      : tone === "secondary"
        ? "text-muted-foreground"
        : "text-primary";
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : ""}>{value}</div>
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1">{title}</div>
      <pre className="bg-muted rounded p-3 text-xs overflow-x-auto max-h-64">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
