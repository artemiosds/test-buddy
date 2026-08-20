import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getLogsNotificacoes } from '@/lib/logs-notificacoes.functions';
import { useServerFn } from '@tanstack/react-start';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_authenticated/relatorio-notificacoes')({
  component: RelatorioNotificacoes,
});

function RelatorioNotificacoes() {
  const fetchLogs = useServerFn(getLogsNotificacoes);
  
  const { data: logs, isLoading, error } = useQuery({
    queryKey: ['logs-notificacoes'],
    queryFn: () => fetchLogs(),
  });

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Notificações</h1>
          <p className="text-muted-foreground mt-1">
            Auditoria de disparos de e-mail via SMTP.
          </p>
        </div>
        <Mail className="h-8 w-8 text-muted-foreground opacity-50" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Histórico de Envios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando logs...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive space-y-2">
              <AlertCircle className="h-8 w-8" />
              <p>Erro ao carregar logs.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Data/Hora</TableHead>
                    <TableHead>Destinatário</TableHead>
                    <TableHead>Assunto</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs && logs.length > 0 ? (
                    logs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {format(new Date(log.data_envio), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate" title={log.destinatario}>
                          {log.destinatario}
                        </TableCell>
                        <TableCell>{log.assunto}</TableCell>
                        <TableCell>
                          {log.status === 'enviado' ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Enviado
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Erro
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={log.detalhe_erro}>
                          {log.detalhe_erro || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                        Nenhum log encontrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
