import { useQuery } from "@tanstack/react-query";
import { listarAvisosAtivos } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Megaphone, Info, AlertTriangle, Settings, Clock } from "lucide-react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetDescription
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCurrentUser } from "@/hooks/use-permissions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

export function MuralHeaderSino() {
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);

  const { data: avisos } = useQuery({
    queryKey: ["mural-avisos-sino", user?.id],
    queryFn: () => fetchAvisos(),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const unreadCount = (avisos || []).filter((a: any) => {
    const leitura = a.leituras?.find((l: any) => l.usuario_id === user?.id);
    if (!leitura) return true;
    if (a.confirmacao_obrigatoria && !leitura.confirmado) return true;
    return false;
  }).length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full hover:bg-accent">
          <Megaphone className="h-4 w-4" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span 
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[450px]">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-blue-500" />
            Mural de Avisos Institucionais
          </SheetTitle>
          <SheetDescription>
            Comunicados e alertas institucionais.
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)] mt-4 pr-4">
          <div className="space-y-4">
            {avisos && avisos.length > 0 ? (
              avisos.map((aviso: any) => {
                const isRead = !!aviso.leituras?.find((l: any) => l.usuario_id === user?.id && (!aviso.confirmacao_obrigatoria || l.confirmado));
                
                return (
                  <div 
                    key={aviso.id} 
                    className={`p-4 rounded-lg border transition-colors ${!isRead ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {aviso.tipo === 'urgente' ? (
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                        ) : aviso.tipo === 'manutencao' ? (
                          <Settings className="h-5 w-5 text-warning" />
                        ) : (
                          <Info className="h-5 w-5 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-semibold text-sm leading-tight">{aviso.titulo}</h4>
                          {!isRead && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {aviso.mensagem}
                        </p>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(aviso.criado_em), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="text-sm">Não há avisos para você.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
