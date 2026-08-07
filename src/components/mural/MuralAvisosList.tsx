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
  Mail,
  Paperclip,
  FileText,
  Search,
  Filter,
  MoreVertical,
  Plus,
  Clock,
  User,
  Database,
  LayoutGrid,
  Star,
  MessageSquare
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/use-permissions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { SafeHtml } from "@/components/shared/SafeHtml";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

export function MuralAvisosList() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);
  const disableAviso = useServerFn(desativarAviso);
  const resendEmail = useServerFn(reenviarEmailAviso);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("todos");

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

  const filteredAvisos = useMemo(() => {
    if (!avisos) return [];
    return avisos.filter((a: any) => {
      const matchesSearch = 
        a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.mensagem.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      if (filter === "todos") return true;
      if (filter === "urgentes") return a.tipo === 'urgente' || a.prioridade === 'critica';
      if (filter === "manutencao") return a.tipo === 'manutencao';
      if (filter === "com_anexos") return a.anexos && a.anexos.length > 0;
      return true;
    });
  }, [avisos, searchTerm, filter]);

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const getCategoryIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'manutencao': return <Settings className="h-5 w-5 text-amber-500" />;
      case 'rh': return <User className="h-5 w-5 text-emerald-500" />;
      case 'ti': return <Database className="h-5 w-5 text-purple-500" />;
      case 'sistema': return <LayoutGrid className="h-5 w-5 text-blue-500" />;
      default: return <Megaphone className="h-5 w-5 text-blue-500" />;
    }
  };

  const getPriorityBadge = (prioridade: string) => {
    switch (prioridade) {
      case 'critica': return <Badge variant="destructive" className="uppercase text-[10px]">Crítico</Badge>;
      case 'alta': return <Badge className="bg-orange-500 text-white hover:bg-orange-600 uppercase text-[10px]">Urgente</Badge>;
      case 'normal': return <Badge variant="secondary" className="uppercase text-[10px]">Informativo</Badge>;
      default: return <Badge variant="outline" className="uppercase text-[10px]">{prioridade}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-muted/30 p-4 rounded-2xl border border-border/50">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Central de Comunicação Institucional
          </h2>
          <p className="text-sm text-muted-foreground">Gerencie e visualize todos os comunicados ativos no sistema.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Pesquisar..." 
              className="pl-9 bg-background focus-visible:ring-primary/20 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Filtrar</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilter("todos")}>Todos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("urgentes")}>Urgentes</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("manutencao")}>Manutenção</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("com_anexos")}>Com anexos</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {filteredAvisos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground bg-muted/10 rounded-3xl border-2 border-dashed border-border/50">
          <Megaphone className="h-16 w-16 mb-4 opacity-10" />
          <h3 className="text-lg font-bold">Nenhum aviso encontrado</h3>
          <p className="text-sm">Tente ajustar sua pesquisa ou filtros.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {filteredAvisos.map((aviso: any) => (
            <Card 
              key={aviso.id} 
              className={cn(
                "group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-primary/30 rounded-2xl bg-card border border-border/60",
                aviso.fixado && "ring-1 ring-primary/20 border-primary/40",
                aviso.status === 'rascunho' && "opacity-80 grayscale-[0.3]"
              )}
            >
              {aviso.tipo === 'urgente' && (
                <div className="absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 bg-destructive/10 rounded-full blur-2xl" />
              )}
              
              <CardHeader className="pb-4 space-y-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-xl transition-colors",
                      aviso.tipo === 'urgente' ? "bg-destructive/10" : 
                      aviso.tipo === 'manutencao' ? "bg-amber-100" : "bg-primary/5"
                    )}>
                      {getCategoryIcon(aviso.tipo)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {aviso.tipo}
                        </span>
                        {aviso.fixado && <Pin className="h-3 w-3 text-primary fill-primary" />}
                      </div>
                      <CardTitle className="text-lg font-extrabold leading-tight group-hover:text-primary transition-colors">
                        {aviso.titulo}
                      </CardTitle>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getPriorityBadge(aviso.prioridade)}
                    {aviso.status === 'rascunho' && (
                      <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[9px] h-4">RASCUNHO</Badge>
                    )}
                  </div>
                </div>
                {aviso.subtitulo && (
                  <CardDescription className="text-xs font-bold text-muted-foreground line-clamp-1 italic">
                    {aviso.subtitulo}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="space-y-4">
                <SafeHtml 
                  html={aviso.mensagem} 
                  className="text-sm text-foreground/80 line-clamp-3 prose prose-sm dark:prose-invert max-w-none min-h-[4.5em] leading-relaxed" 
                />
                
                <div className="flex flex-wrap gap-3 py-3 border-y border-border/50 text-[11px] font-medium text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(aviso.criado_em), "dd/MM/yy HH:mm")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {aviso.leituras?.length || 0} visualizações
                  </div>
                  {aviso.anexos && aviso.anexos.length > 0 && (
                    <div className="flex items-center gap-1.5 text-primary">
                      <Paperclip className="h-3.5 w-3.5" />
                      {aviso.anexos.length} anexos
                    </div>
                  )}
                  {aviso.confirmacao_obrigatoria && (
                    <div className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Obrigatório
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="flex items-center gap-1.5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 font-bold text-[11px] px-3 shadow-sm"
                            onClick={() => window.dispatchEvent(new CustomEvent('open-mural-aviso', { detail: aviso }))}
                          >
                            <Eye className="h-3 w-3 mr-1.5" /> Ver Detalhes
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Visualizar como o usuário verá</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  
                  {isManagement && (
                    <div className="flex items-center gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-2">
                          <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-bold px-2 py-1.5">Ações de Gestão</DropdownMenuLabel>
                          <DropdownMenuItem 
                            disabled={mutationReenviar.isPending}
                            onClick={() => mutationReenviar.mutate(aviso.id)}
                            className="flex items-center gap-2 cursor-pointer font-medium py-2"
                          >
                            <Mail className="h-4 w-4 text-primary" /> 
                            {aviso.email_enviado_em ? "Reenviar Notificação" : "Notificar por E-mail"}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem 
                            onClick={() => {
                              if (confirm("Deseja realmente desativar este aviso?")) {
                                mutationDesativar.mutate(aviso.id);
                              }
                            }}
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/5 font-medium py-2"
                          >
                            <Trash2 className="h-4 w-4" /> Desativar Comunicado
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

