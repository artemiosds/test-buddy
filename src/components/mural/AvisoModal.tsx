import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listarAvisosAtivos, marcarComoLido, confirmarCiencia } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-permissions";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { AlertTriangle, Info, Settings } from "lucide-react";

export function AvisoModal() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);
  const markAsRead = useServerFn(marcarComoLido);
  const confirm = useServerFn(confirmarCiencia);

  const [currentAviso, setCurrentAviso] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: avisos } = useQuery({
    queryKey: ["mural-avisos-popup", user?.id],
    queryFn: () => fetchAvisos(),
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (avisos && Array.isArray(avisos) && avisos.length > 0) {
      const pendingAvisos = avisos.filter((a: any) => {
        const leitura = a.leituras?.find((l: any) => l.usuario_id === user?.id);
        if (!leitura) return true;
        if (a.confirmacao_obrigatoria && !leitura.confirmado) return true;
        return false;
      });

      if (pendingAvisos.length > 0) {
        const sorted = [...pendingAvisos].sort((a: any, b: any) => {
          if (a.prioridade === 'critica' && b.prioridade !== 'critica') return -1;
          if (b.prioridade === 'critica' && a.prioridade !== 'critica') return 1;
          return 0;
        });
        setCurrentAviso(sorted[0]);
        setOpen(true);
      }
    }
  }, [avisos, user?.id]);

  const handleClose = async () => {
    if (!currentAviso) return;
    
    if (currentAviso.confirmacao_obrigatoria) {
      return;
    }

    try {
      await markAsRead({ data: { avisoId: currentAviso.id } });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-popup"] });
      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirm = async () => {
    if (!currentAviso) return;
    try {
      await confirm({ data: { avisoId: currentAviso.id } });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-popup"] });
      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const formatarData = (dataStr: string) => {
    try {
      return format(new Date(dataStr), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "";
    }
  };

  if (!currentAviso) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            {currentAviso.tipo === 'urgente' ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : currentAviso.tipo === 'manutencao' ? (
              <Settings className="h-6 w-6 text-warning" />
            ) : (
              <Info className="h-6 w-6 text-blue-500" />
            )}
            <DialogTitle className="text-xl">{currentAviso.titulo}</DialogTitle>
          </div>
          <DialogDescription>
            Informativo do Mural de Avisos
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 text-sm text-muted-foreground italic mb-2">
          Publicado em: {formatarData(currentAviso.criado_em)}
        </div>
        
        <div className="py-4 whitespace-pre-wrap text-foreground">
          {currentAviso.mensagem}
        </div>

        <DialogFooter>
          {currentAviso.confirmacao_obrigatoria ? (
            <Button onClick={handleConfirm} className="w-full">
              Li e estou ciente
            </Button>
          ) : (
            <Button onClick={handleClose} variant="secondary">
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
