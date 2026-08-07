import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarAvisosArquivados, reativarAviso } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { 
  History, 
  RotateCcw, 
  Eye, 
  Clock, 
  Calendar,
  User,
  AlertTriangle,
  Info,
  Settings,
  Megaphone,
  Database,
  LayoutGrid,
  FileText
} from "lucide-react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { useState } from "react";
import { SafeHtml } from "@/components/shared/SafeHtml";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MuralArquivoHistorico() {
  const queryClient = useQueryClient();
  const fetchArquivados = useServerFn(listarAvisosArquivados);
  const reativar = useServerFn(reativarAviso);
  const [selectedAviso, setSelectedAviso] = useState<any>(null);

  const { data: avisos, isLoading } = useQuery({
    queryKey: ["mural-avisos-arquivados"],
    queryFn: () => fetchArquivados(),
  });

  const mutationReativar = useMutation({
    mutationFn: (id: string) => reativar({ data: { avisoId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-arquivados"] });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      toast.success("Aviso reativado com sucesso!");
    },
    onError: () => toast.error("Erro ao reativar aviso")
  });

  const getStatus = (aviso: any) => {
    const today = new Date().toISOString().split('T')[0];
    if (!aviso.ativo) return <Badge variant="secondary">Desativado</Badge>;
    if (aviso.data_fim && aviso.data_fim < today) return <Badge variant="outline" className="text-amber-600 border-amber-200">Expirado</Badge>;
    return <Badge>Ativo</Badge>;
  };

  const getCategoryIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'manutencao': return <Settings className="h-4 w-4 text-amber-500" />;
      default: return <Megaphone className="h-4 w-4 text-primary" />;
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando histórico...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {avisos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum aviso no histórico.
                </TableCell>
              </TableRow>
            ) : (
              avisos?.map((aviso: any) => (
                <TableRow key={aviso.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(aviso.tipo)}
                      {aviso.titulo}
                    </div>
                  </TableCell>
                  <TableCell className="capitalize text-xs">{aviso.tipo}</TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(aviso.data_inicio), 'dd/MM/yyyy')} 
                    {aviso.data_fim ? ` - ${format(new Date(aviso.data_fim), 'dd/MM/yyyy')}` : ' (Indeterminado)'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(aviso.criado_em), 'dd/MM/yyyy HH:mm')}
                  </TableCell>
                  <TableCell>{getStatus(aviso)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedAviso(aviso)}>
                      <Eye className="h-4 w-4 mr-2" /> Conteúdo
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => mutationReativar.mutate(aviso.id)}
                      disabled={mutationReativar.isPending}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Reativar
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedAviso} onOpenChange={() => setSelectedAviso(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              {selectedAviso && getCategoryIcon(selectedAviso.tipo)}
              {selectedAviso?.titulo}
            </DialogTitle>
            <DialogDescription>
              Detalhes do aviso arquivado
            </DialogDescription>
          </DialogHeader>
          
          {selectedAviso && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/30 rounded-xl border">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo</span>
                    <p className="text-sm font-medium capitalize">{selectedAviso.tipo}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Prioridade</span>
                    <p className="text-sm font-medium capitalize">{selectedAviso.prioridade}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Criado por</span>
                    <p className="text-sm font-medium">{selectedAviso.criador?.nome || 'Sistema'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">Período</span>
                    <p className="text-sm font-medium">
                      {format(new Date(selectedAviso.data_inicio), 'dd/MM/yyyy')}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Conteúdo da Mensagem
                  </h4>
                  <div className="p-6 bg-card border rounded-2xl shadow-inner min-h-[200px]">
                    <SafeHtml html={selectedAviso.mensagem} className="prose prose-sm dark:prose-invert max-w-none" />
                  </div>
                </div>

                {selectedAviso.anexos?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      Anexos ({selectedAviso.anexos.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAviso.anexos.map((anexo: any) => (
                        <Badge key={anexo.id} variant="outline" className="flex items-center gap-2 py-1 px-3">
                          <FileText className="h-3 w-3" />
                          {anexo.nome}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
