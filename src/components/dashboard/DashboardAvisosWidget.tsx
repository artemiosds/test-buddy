import { useQuery } from "@tanstack/react-query";
import { listarAvisosAtivos } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { Megaphone, ArrowRight, Info, AlertTriangle, Settings } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function DashboardAvisosWidget() {
  const fetchAvisos = useServerFn(listarAvisosAtivos);

  const { data: avisos, isLoading } = useQuery({
    queryKey: ["dashboard-avisos"],
    queryFn: () => fetchAvisos(),
    staleTime: 5 * 60 * 1000,
  });

  const displayAvisos = (avisos || []).slice(0, 3);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Comunicados
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="h-20 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : displayAvisos.length > 0 ? (
          displayAvisos.map((aviso: any) => (
            <div key={aviso.id} className="border-l-4 border-primary pl-3 py-1 bg-muted/30 rounded-r-md">
              <div className="flex items-center gap-2 mb-1">
                {aviso.tipo === 'urgente' ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : aviso.tipo === 'manutencao' ? (
                  <Settings className="h-4 w-4 text-warning" />
                ) : (
                  <Info className="h-4 w-4 text-blue-500" />
                )}
                <span className="font-semibold text-sm truncate">{aviso.titulo}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {aviso.mensagem}
              </p>
              <div className="mt-1 text-[10px] text-muted-foreground italic">
                {format(new Date(aviso.criado_em), "dd/MM/yyyy", { locale: ptBR })}
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm italic opacity-50">
            Nenhum comunicado ativo.
          </div>
        )}
      </CardContent>
      {avisos && avisos.length > 3 && (
        <CardFooter className="pt-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
            <Link to="/administracao/mural">
              Ver todos <ArrowRight className="ml-2 h-3 w-3" />
            </Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
