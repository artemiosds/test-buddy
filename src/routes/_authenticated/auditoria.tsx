import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/permission-gate";
import { Download, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { auditClient, AUDIT_ACOES } from "@/lib/audit-client";
import { Pagination } from "@/components/shared/Pagination";

export const Route = createFileRoute("/_authenticated/auditoria")({
  component: AuditoriaPage,
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

function AuditoriaPage() {
  const [operacao, setOperacao] = useState<Operacao | "todas">("todas");
  const [tabela, setTabela] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [dias, setDias] = useState<string>("7");
  const [detalhe, setDetalhe] = useState<AuditRow | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [operacao, tabela, busca, dias, pageSize]);

  const desde = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - Number(dias));
    return d.toISOString();
  }, [dias]);

  const { data: tabelas } = useQuery({
    queryKey: ["auditoria", "tabelas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("tabela")
        .order("tabela")
        .limit(1000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: { tabela: string }) => set.add(r.tabela));
      return Array.from(set).sort();
    },
  });

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["auditoria", { operacao, tabela, busca, desde, page, pageSize }],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let q = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .gte("ocorrido_em", desde)
        .order("ocorrido_em", { ascending: false });
      if (operacao !== "todas") q = q.eq("operacao", operacao);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      if (busca.trim()) {
        const b = busca.trim();
        q = q.or(
          `usuario_email.ilike.%${b}%,registro_id.ilike.%${b}%,tabela.ilike.%${b}%`,
        );
      }
      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  const exportarCsv = async () => {
    if (!total) {
      toast.error("Nada para exportar");
      return;
    }
    // Exporta o conjunto filtrado inteiro (não apenas a página atual), limitado a 5000
    let q = supabase
      .from("audit_log")
      .select("*")
      .gte("ocorrido_em", desde)
      .order("ocorrido_em", { ascending: false })
      .limit(5000);
    if (operacao !== "todas") q = q.eq("operacao", operacao);
    if (tabela !== "todas") q = q.eq("tabela", tabela);
    if (busca.trim()) {
      const b = busca.trim();
      q = q.or(`usuario_email.ilike.%${b}%,registro_id.ilike.%${b}%,tabela.ilike.%${b}%`);
    }
    const { data: exportRows, error } = await q;
    if (error || !exportRows?.length) {
      toast.error("Falha ao preparar exportação");
      return;
    }
    if (total > 5000) {
      toast.warning(`Exportação limitada a 5000 registros (total filtrado: ${total}).`);
    }
    const header = [
      "ocorrido_em", "operacao", "tabela", "registro_id",
      "usuario_email", "ip",
    ];
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
    a.download = `auditoria_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    void auditClient.action(AUDIT_ACOES.EXPORT_CSV, {
      tabela: "audit_log",
      contexto: { total: (exportRows as AuditRow[]).length, filtros: { operacao, tabela, dias } },
    });
  };

  return (
    <PermissionGate permission="auditoria.visualizar">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Auditoria
            </h1>
            <p className="text-sm text-muted-foreground">
              Trilha completa de operações no sistema.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <PermissionGate permission="auditoria.exportar" fallback={null}>
              <Button size="sm" onClick={() => void exportarCsv()}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </PermissionGate>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por e-mail, tabela ou registro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <Select value={operacao} onValueChange={(v) => setOperacao(v as Operacao | "todas")}>
            <SelectTrigger><SelectValue placeholder="Operação" /></SelectTrigger>
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
            <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas tabelas</SelectItem>
              {(tabelas ?? []).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger><SelectValue placeholder="Período" /></SelectTrigger>
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
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum registro encontrado.</td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">
                      {new Date(r.ocorrido_em).toLocaleString("pt-BR")}
                    </td>
                    <td className="p-3">
                      <Badge variant={OP_VARIANT[r.operacao]}>{OP_LABEL[r.operacao]}</Badge>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.tabela}</td>
                    <td className="p-3 font-mono text-xs truncate max-w-[200px]">{r.registro_id ?? "—"}</td>
                    <td className="p-3">{r.usuario_email ?? <span className="text-muted-foreground">sistema</span>}</td>
                    <td className="p-3">
                      <Button size="icon" variant="ghost" onClick={() => setDetalhe(r)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
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
              <DialogTitle>Detalhes da operação</DialogTitle>
            </DialogHeader>
            {detalhe && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info label="Data/Hora" value={new Date(detalhe.ocorrido_em).toLocaleString("pt-BR")} />
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
                {detalhe.contexto != null && (
                  <JsonBlock title="Contexto" data={detalhe.contexto} />
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGate>
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
