import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import { PermissionGate } from "@/components/permission-gate";
import { Download, Eye, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { auditClient, AUDIT_ACOES } from "@/lib/audit-client";
import { Pagination } from "@/components/shared/Pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FolhaTimeline } from "@/components/auditoria/folha-timeline";
import { DownloadsLog } from "@/components/auditoria/downloads-log";
import { PrivacidadeLgpd } from "@/components/auditoria/privacidade-lgpd";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import { nivelPrivacidade } from "@/lib/lgpd";
import { gerarPdfAuditoriaFolha } from "@/lib/pdf-auditoria-folha";
import { detectarAchados, type LinhaTrilha } from "@/lib/auditoria-achados";
import { Textarea } from "@/components/ui/textarea";

/** Exibição padronizada do nome da tabela (sem prefixo de schema). */
function nomeTabela(t: string): string {
  return t.replace(/^public\./, "");
}

/** Autoria real da operação; nunca mascara ausência de autor como "sistema". */
function autorLabel(r: { usuario_email: string | null; usuario_id: string | null }) {
  if (r.usuario_email) return <span>{r.usuario_email}</span>;
  if (r.usuario_id)
    return <span className="font-mono text-xs">{r.usuario_id.slice(0, 8)}… (e-mail ausente)</span>;
  return <span className="text-destructive">não identificado — investigar</span>;
}


export const Route = createFileRoute("/_authenticated/auditoria")({ errorComponent: ErrorComponent,
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
  const [obsOpen, setObsOpen] = useState(false);
  const [obsAuditor, setObsAuditor] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);


  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const nivel = nivelPrivacidade({ isMaster: me?.is_master ?? false, has });
  const usuarioRastreio = {
    nome: me?.nome_completo ?? me?.email ?? "usuário",
    identificador: me?.email ?? "—",
  };

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
        q = q.or(`usuario_email.ilike.%${b}%,registro_id.ilike.%${b}%,tabela.ilike.%${b}%`);
      }
      const { data, count, error } = await q.range(from, to);
      if (error) throw error;
      return { rows: (data ?? []) as AuditRow[], count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;

  // Achados automáticos sobre a janela filtrada (até 5000 registros)
  const { data: achados = [] } = useQuery({
    queryKey: ["auditoria", "achados", { desde, tabela, operacao }],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("ocorrido_em, operacao, tabela, registro_id, usuario_id, usuario_email, ip")
        .gte("ocorrido_em", desde)
        .order("ocorrido_em", { ascending: false })
        .limit(5000);
      if (operacao !== "todas") q = q.eq("operacao", operacao);
      if (tabela !== "todas") q = q.eq("tabela", tabela);
      const { data: linhas, error } = await q;
      if (error) throw error;
      return detectarAchados((linhas ?? []) as LinhaTrilha[]);
    },
  });


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
              <Button variant="outline" size="sm" onClick={() => setObsOpen(true)}>
                <FileText className="h-4 w-4 mr-1" />
                Auditoria Forense (PDF)
              </Button>

              <Button size="sm" onClick={() => void exportarCsv()}>
                <Download className="h-4 w-4 mr-1" />
                Exportar CSV
              </Button>
            </PermissionGate>
          </div>
        </div>

        <Tabs defaultValue="trilha" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="trilha">Trilha de operações</TabsTrigger>
            <TabsTrigger value="folha">Linha do tempo da folha</TabsTrigger>
            <TabsTrigger value="downloads">Downloads e extrações</TabsTrigger>
            <TabsTrigger value="lgpd">Privacidade e fé pública</TabsTrigger>
          </TabsList>

          <TabsContent value="folha">
            <FolhaTimeline nivel={nivel} usuario={usuarioRastreio} />
          </TabsContent>
          <TabsContent value="downloads">
            <DownloadsLog />
          </TabsContent>
          <TabsContent value="lgpd">
            <PrivacidadeLgpd nivel={nivel} usuario={usuarioRastreio} />
          </TabsContent>

          <TabsContent value="trilha" className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por e-mail, tabela ou registro..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
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
              <SelectItem value="todas">Todas tabelas</SelectItem>
              {(tabelas ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
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

        {achados.length > 0 && (
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="text-sm font-semibold">Achados e pontos de controle (automático)</div>
            {achados.map((a) => (
              <div key={a.titulo} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant={
                    a.nivel === "alto" ? "destructive" : a.nivel === "medio" ? "default" : "outline"
                  }
                >
                  {a.nivel === "alto" ? "Alta" : a.nivel === "medio" ? "Média" : "Informativo"}
                </Badge>
                <span className="font-medium">{a.titulo}</span>
                <span className="text-muted-foreground">
                  {a.ocorrencias} ocorrência(s) · {a.detalhe}
                </span>
              </div>
            ))}
          </div>
        )}

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
                  <th className="p-3">IP</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum registro encontrado.
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
                      <td className="p-3 font-mono text-xs">{nomeTabela(r.tabela)}</td>
                      <td className="p-3 font-mono text-xs truncate max-w-[200px]">
                        {r.registro_id ?? "—"}
                      </td>
                      <td className="p-3">{autorLabel(r)}</td>
                      <td className="p-3 font-mono text-xs">
                        {r.ip ?? <span className="text-muted-foreground">não capturado</span>}
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
          </TabsContent>
        </Tabs>



        <Dialog open={obsOpen} onOpenChange={setObsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Auditoria Forense — observações do auditor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Os achados são detectados automaticamente sobre a trilha do período
                selecionado. Registre abaixo observações manuais, se houver.
              </p>
              <Textarea
                rows={5}
                placeholder="Observações do auditor (opcional)"
                value={obsAuditor}
                onChange={(e) => setObsAuditor(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setObsOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    setObsOpen(false);
                    void gerarPdfAuditoriaFolha({
                      dias: Number(dias),
                      observacoes: obsAuditor,
                    });
                  }}
                >
                  Gerar PDF
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da operação</DialogTitle>
            </DialogHeader>
            {detalhe && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Info
                    label="Data/Hora"
                    value={new Date(detalhe.ocorrido_em).toLocaleString("pt-BR")}
                  />
                  <Info label="Operação" value={OP_LABEL[detalhe.operacao]} />
                  <Info label="Tabela" value={nomeTabela(detalhe.tabela)} mono />
                  <Info label="Registro" value={detalhe.registro_id ?? "—"} mono />
                  <Info
                    label="Usuário"
                    value={
                      detalhe.usuario_email ??
                      (detalhe.usuario_id
                        ? `${detalhe.usuario_id} (e-mail ausente)`
                        : "não identificado — investigar")
                    }
                  />
                  <Info label="IP" value={detalhe.ip ?? "não capturado"} />
                </div>
                {detalhe.operacao === "update" && (
                  <DiffBlock
                    anterior={detalhe.valor_anterior}
                    novo={detalhe.valor_novo}
                  />
                )}
                {detalhe.valor_anterior != null && (
                  <JsonBlock title="Valor anterior (completo)" data={detalhe.valor_anterior} />
                )}
                {detalhe.valor_novo != null && (
                  <JsonBlock title="Valor novo (completo)" data={detalhe.valor_novo} />
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
