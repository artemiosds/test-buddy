import { useQuery } from "@tanstack/react-query";
import { listarAvisosAtivos } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, ArrowRight, Info, AlertTriangle, Settings, Clock, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SafeHtml } from "@/components/shared/SafeHtml";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DashboardAvisosWidget() {
  const fetchAvisos = useServerFn(listarAvisosAtivos);

  const { data: avisos, isLoading } = useQuery({
    queryKey: ["dashboard-avisos"],
    queryFn: () => fetchAvisos(),
    staleTime: 5 * 60 * 1000,
  });

  const displayAvisos = (avisos || []).slice(0, 3);

  const getCategoryIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'manutencao': return <Settings className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-xl bg-gradient-to-br from-card to-muted/20 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-lg font-extrabold flex items-center gap-2 tracking-tight">
            <div className="p-2 rounded-xl bg-primary/10">
              <Megaphone className="h-5 w-5 text-primary" />
            </div>
            Comunicados
          </CardTitle>
          <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Institucional</p>
        </div>
        {avisos && avisos.length > 0 && (
          <Badge variant="secondary" className="font-bold text-[10px] bg-primary/5 text-primary border-primary/10">
            {avisos.length} ativos
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto p-4 pt-0 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : displayAvisos.length > 0 ? (
          displayAvisos.map((aviso: any) => (
            <div 
              key={aviso.id} 
              className={cn(
                "group relative p-4 rounded-2xl border transition-all duration-300 hover:shadow-md hover:border-primary/20 bg-background/50 overflow-hidden cursor-pointer",
                aviso.prioridade === 'critica' && "border-destructive/20 bg-destructive/[0.02]"
              )}
              onClick={() => window.dispatchEvent(new CustomEvent('open-mural-aviso', { detail: aviso }))}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  aviso.tipo === 'urgente' ? "bg-destructive/10" : 
                  aviso.tipo === 'manutencao' ? "bg-amber-100" : "bg-primary/5"
                )}>
                  {getCategoryIcon(aviso.tipo)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{aviso.titulo}</h4>
                    <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap uppercase tracking-tighter">
                      {formatDistanceToNow(new Date(aviso.criado_em), { locale: ptBR })}
                    </span>
                  </div>
                  <SafeHtml html={aviso.mensagem} className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/50 mb-3 opacity-20">
              <Megaphone className="h-10 w-10" />
            </div>
            <p className="text-xs font-medium italic opacity-50">Nenhum comunicado ativo.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 bg-muted/10 border-t">
        <Button variant="ghost" size="sm" className="w-full text-[11px] font-extrabold uppercase tracking-widest hover:bg-primary/5 hover:text-primary group" asChild>
          <Link to="/administracao/mural">
            Ver Central de Comunicação 
            <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

