import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listarAvisosAtivos, desativarAviso, reenviarEmailAviso } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { 
  Megaphone, 
  Trash2, 
  AlertTriangle, 
  Info, 
  Settings,
  Eye,
  CheckCircle2,
  Pin,
  Mail
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export function MuralAvisosList() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);
  const disableAviso = useServerFn(desativarAviso);
  const resendEmail = useServerFn(reenviarEmailAviso);


  const isManagement = user?.perfil_codigo === 'MASTER' || user?.perfil_codigo === 'GESTOR' || user?.is_master;

  const { data: avisos, isLoading } = useQuery({
    queryKey: ["mural-avisos"],
    queryFn: () => fetchAvisos(),
  });

  const mutationDesativar = useMutation({
    mutationFn: (id: string) => disableAviso({ data: { avisoId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      toast.success("Aviso desativado com sucesso");
    },
    onError: () => toast.error("Erro ao desativar aviso")
  });

  const mutationReenviar = useMutation({
    mutationFn: (id: string) => resendEmail({ data: { avisoId: id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      toast.success("E-mail reenviado com sucesso!");
    },
    onError: (err: any) => toast.error(`Erro ao reenviar e-mail: ${err.message}`)
  });


  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!avisos || avisos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground bg-muted/20 rounded-lg border-2 border-dashed">
        <Megaphone className="h-12 w-12 mb-4 opacity-20" />
        <p>Nenhum aviso ativo no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
      {avisos.map((aviso: any) => (
        <Card key={aviso.id} className={aviso.fixado ? "border-primary/50 shadow-sm" : ""}>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                {aviso.tipo === 'urgente' ? (
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                ) : aviso.tipo === 'manutencao' ? (
                  <Settings className="h-5 w-5 text-warning" />
                ) : (
                  <Info className="h-5 w-5 text-blue-500" />
                )}
                <CardTitle className="text-lg">{aviso.titulo}</CardTitle>
                {aviso.fixado && <Pin className="h-4 w-4 text-primary fill-primary" />}
              </div>
              <div className="flex gap-2">
                <Badge variant={aviso.prioridade === 'critica' ? 'destructive' : 'secondary'}>
                  {aviso.prioridade}
                </Badge>
              </div>
            </div>
            <CardDescription>
              Publicado em {format(new Date(aviso.criado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-4">
              {aviso.mensagem}
            </p>
            <div className="flex justify-between items-center mt-4">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {aviso.leituras?.length || 0} visualizações
                </span>
                {aviso.confirmacao_obrigatoria && (
                  <span className="flex items-center gap-1 text-primary">
                    <CheckCircle2 className="h-3 w-3" /> Confirmação Obrigatória
                  </span>
                )}
              </div>
              
              {isManagement && (
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary hover:bg-primary/10"
                    disabled={mutationReenviar.isPending}
                    onClick={() => mutationReenviar.mutate(aviso.id)}
                  >
                    <Mail className="h-4 w-4 mr-2" /> 
                    {aviso.email_enviado_em ? "Reenviar E-mail" : "Enviar E-mail"}
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Deseja realmente desativar este aviso?")) {
                        mutationDesativar.mutate(aviso.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Desativar
                  </Button>
                </div>
              )}

            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
