import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  ShieldCheck, 
  ShieldAlert, 
  History, 
  Search, 
  Filter, 
  Eye,
  Info,
  Server
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { getSSOMetrics, getSSOLogs } from "@/lib/sso.functions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function AuditSSOView() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sistemaFilter, setSistemaFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: sistemas } = useQuery({
    queryKey: ["sistemas-externos-lista-filtro"],
    queryFn: async () => {
      const { data } = await supabase.from("sistemas_externos").select("id, nome").eq("ativo", true);
      return data || [];
    }
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ["sso-metrics"],
    queryFn: () => getSSOMetrics(),
    refetchInterval: 30000,
  });

  const { data: logs, isLoading: loadingLogs } = useQuery({
    queryKey: ["sso-logs", statusFilter, sistemaFilter],
    queryFn: () => getSSOLogs({ 
      data: { 
        status: statusFilter as any,
        sistemaId: sistemaFilter !== "all" ? sistemaFilter : undefined,
        limit: 100
      } 
    }),
    refetchInterval: 10000,
  });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter(log => 
      log.usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.sistemaDestino.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.cpf.includes(searchTerm)
    );
  }, [logs, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Dashboard Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistemas Conectados</CardTitle>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalSistemas || 0}</div>
            <p className="text-xs text-muted-foreground">Ecossistema ativo</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sucessos (24h)</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.ssoSucessos || 0}</div>
            <p className="text-xs text-muted-foreground">Autenticações válidas</p>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Falhas (24h)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.ssoFalhas || 0}</div>
            <p className="text-xs text-muted-foreground">Tentativas negadas</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Central</CardTitle>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics?.statusCentral || "Online"}</div>
            <p className="text-xs text-muted-foreground">Monitoramento ativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                Auditoria de Acessos SSO
              </CardTitle>
              <CardDescription>Logs em tempo real das integrações externas</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full md:w-48">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome ou CPF..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Select value={sistemaFilter} onValueChange={setSistemaFilter}>
                <SelectTrigger className="w-[180px]">
                  <Server className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Sistema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Sistemas</SelectItem>
                  {sistemas?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="error">Falha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Sistema Destino</TableHead>
                  <TableHead className="hidden md:table-cell">IP</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLogs ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Carregando logs de auditoria...
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      Nenhum registro encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">
                        {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{log.usuario}</span>
                          <span className="text-[10px] text-muted-foreground">CPF: {log.cpf}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {log.sistemaDestino}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                        {log.ip || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={log.resultado === "Sucesso" ? "default" : "destructive"}
                          className={log.resultado === "Sucesso" ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                          {log.resultado}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Detalhes do Evento de Auditoria
            </DialogTitle>
            <DialogDescription>
              Payload completo e metadados do acesso SSO
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">ID do Evento</p>
                  <p className="font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Operação</p>
                  <p className="capitalize">{selectedLog.operacao}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dispositivo/User-Agent</p>
                  <p className="truncate" title={selectedLog.dispositivo}>{selectedLog.dispositivo || "Não identificado"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className={selectedLog.resultado === "Sucesso" ? "text-green-600 font-bold" : "text-destructive font-bold"}>
                    {selectedLog.resultado}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Contexto do Payload (JSON)</p>
                <div className="bg-muted p-4 rounded-md overflow-auto max-h-[300px]">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedLog.detalhes, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
