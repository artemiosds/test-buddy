import { useQuery } from "@tanstack/react-query";
import { listarAvisosAtivos } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { 
  Bell, 
  Megaphone, 
  Info, 
  AlertTriangle, 
  Settings, 
  Clock, 
  Search, 
  Filter, 
  Eye, 
  CheckCircle2, 
  Paperclip, 
  MessageSquare, 
  Star, 
  Share2, 
  Download,
  ExternalLink,
  ChevronRight,
  User,
  LayoutGrid,
  ShieldCheck,
  Stethoscope,
  Database
} from "lucide-react";
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
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SafeHtml } from "@/components/shared/SafeHtml";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type AvisoType = 'informativo' | 'urgente' | 'manutencao' | 'rh' | 'ti' | 'sistema';

export function MuralHeaderSino() {
  const { data: user } = useCurrentUser();
  const fetchAvisos = useServerFn(listarAvisosAtivos);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<string>("todos");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const { data: avisos, isLoading } = useQuery({
    queryKey: ["mural-avisos-sino", user?.id],
    queryFn: () => fetchAvisos(),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAvisos = useMemo(() => {
    if (!avisos) return [];
    
    return avisos.filter((aviso: any) => {
      const matchesSearch = 
        aviso.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        aviso.mensagem.toLowerCase().includes(searchTerm.toLowerCase());
      
      const isRead = !!aviso.leituras?.find((l: any) => l.usuario_id === user?.id && (!aviso.confirmacao_obrigatoria || l.confirmado));
      
      if (!matchesSearch) return false;

      switch (filter) {
        case "nao_lidos": return !isRead;
        case "urgentes": return aviso.tipo === 'urgente' || aviso.prioridade === 'critica' || aviso.prioridade === 'alta';
        case "favoritos": return favorites.has(aviso.id);
        case "com_anexos": return aviso.anexos && aviso.anexos.length > 0;
        case "manutencao": return aviso.tipo === 'manutencao';
        case "rh": return aviso.tipo === 'rh';
        case "ti": return aviso.tipo === 'ti';
        case "sistema": return aviso.tipo === 'sistema';
        default: return true;
      }
    });
  }, [avisos, searchTerm, filter, favorites, user?.id]);

  const unreadCount = (avisos || []).filter((a: any) => {
    const leitura = a.leituras?.find((l: any) => l.usuario_id === user?.id);
    if (!leitura) return true;
    if (a.confirmacao_obrigatoria && !leitura.confirmado) return true;
    return false;
  }).length;

  const getCategoryIcon = (tipo: string) => {
    switch (tipo) {
      case 'urgente': return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'manutencao': return <Settings className="h-4 w-4 text-amber-500" />;
      case 'rh': return <User className="h-4 w-4 text-emerald-500" />;
      case 'ti': return <Database className="h-4 w-4 text-purple-500" />;
      case 'sistema': return <LayoutGrid className="h-4 w-4 text-blue-500" />;
      default: return <Megaphone className="h-4 w-4 text-blue-500" />;
    }
  };

  const getPriorityBadge = (prioridade: string) => {
    switch (prioridade) {
      case 'critica': return <Badge variant="destructive" className="text-[10px] h-4 uppercase">Crítico</Badge>;
      case 'alta': return <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-[10px] h-4 uppercase border-none">Urgente</Badge>;
      case 'normal': return <Badge variant="secondary" className="text-[10px] h-4 uppercase">Informativo</Badge>;
      default: return <Badge variant="outline" className="text-[10px] h-4 uppercase">{prioridade}</Badge>;
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-full hover:bg-accent group">
          <Megaphone className="h-4 w-4 transition-transform group-hover:scale-110" strokeWidth={1.75} />
          {unreadCount > 0 && (
            <span 
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm animate-in zoom-in"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[450px] sm:w-[540px] p-0 flex flex-col border-l-0 sm:border-l shadow-2xl">
        <SheetHeader className="p-6 pb-4 space-y-4 bg-gradient-to-b from-muted/50 to-background border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <SheetTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                Central de Avisos
              </SheetTitle>
              <SheetDescription className="text-xs font-medium">
                Comunicados oficiais e atualizações do sistema HSM Gestão.
              </SheetDescription>
            </div>
            {unreadCount > 0 && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                {unreadCount} novos
              </Badge>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar comunicados..."
                className="pl-9 h-9 bg-background/50 border-muted-foreground/20 focus-visible:ring-primary/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setFilter("todos")} className="flex items-center justify-between">
                  Todos {filter === "todos" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("nao_lidos")} className="flex items-center justify-between">
                  Não lidos {filter === "nao_lidos" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("urgentes")} className="flex items-center justify-between">
                  Urgentes {filter === "urgentes" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("favoritos")} className="flex items-center justify-between">
                  Favoritos {filter === "favoritos" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("com_anexos")} className="flex items-center justify-between">
                  Com anexos {filter === "com_anexos" && <CheckCircle2 className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground font-bold">Categorias</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setFilter("manutencao")} className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-amber-500" /> Manutenção
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("rh")} className="flex items-center gap-2">
                  <User className="h-4 w-4 text-emerald-500" /> RH
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("ti")} className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-500" /> TI
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("sistema")} className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-blue-500" /> Sistema
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-4">
          <div className="py-6 space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : filteredAvisos.length > 0 ? (
              filteredAvisos.map((aviso: any) => {
                const isRead = !!aviso.leituras?.find((l: any) => l.usuario_id === user?.id && (!aviso.confirmacao_obrigatoria || l.confirmado));
                const isFavorite = favorites.has(aviso.id);
                
                return (
                  <div 
                    key={aviso.id} 
                    className={cn(
                      "group relative flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:border-primary/30 cursor-pointer bg-card overflow-hidden",
                      !isRead && "border-primary/20 bg-primary/[0.02]"
                    )}
                  >
                    {!isRead && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                    )}

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2.5">
                        <div className={cn(
                          "p-2 rounded-lg",
                          aviso.tipo === 'urgente' ? "bg-destructive/10" : 
                          aviso.tipo === 'manutencao' ? "bg-amber-100" : "bg-muted"
                        )}>
                          {getCategoryIcon(aviso.tipo)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {aviso.tipo}
                          </span>
                          <h4 className="font-bold text-base leading-tight group-hover:text-primary transition-colors">
                            {aviso.titulo}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {getPriorityBadge(aviso.prioridade)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                          onClick={(e) => toggleFavorite(aviso.id, e)}
                        >
                          <Star className={cn("h-4 w-4", isFavorite && "fill-amber-500 text-amber-500")} />
                        </Button>
                      </div>
                    </div>

                    <SafeHtml 
                      html={aviso.mensagem} 
                      className="text-sm text-muted-foreground line-clamp-2 leading-relaxed" 
                    />

                    <div className="flex items-center flex-wrap gap-x-4 gap-y-2 py-3 border-y border-border/50">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDistanceToNow(new Date(aviso.criado_em), { addSuffix: true, locale: ptBR })}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        {aviso.leituras?.length || 0} visualizações
                      </div>
                      {aviso.anexos && aviso.anexos.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                          <Paperclip className="h-3.5 w-3.5" />
                          {aviso.anexos.length} anexos
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        0 comentários
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="flex gap-1.5">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 text-[11px] font-semibold"
                                onClick={() => window.dispatchEvent(new CustomEvent('open-mural-aviso', { detail: aviso }))}
                              >
                                <ExternalLink className="h-3 w-3 mr-1.5" /> Ver Comunicado
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Ver detalhes e ler conteúdo completo</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        {aviso.anexos && aviso.anexos.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-8 px-3 text-[11px] font-semibold">
                            <Download className="h-3 w-3 mr-1.5" /> Baixar Anexos
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {isRead ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3" /> LIDO
                          </div>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-8 px-3 text-[11px] font-bold text-primary hover:bg-primary/10">
                            Confirmar Leitura
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="p-6 rounded-full bg-muted mb-4 opacity-50">
                  <Megaphone className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-lg">Nenhum comunicado encontrado</h3>
                <p className="text-sm text-muted-foreground max-w-[250px] mx-auto mt-2">
                  Não existem avisos que correspondam aos seus filtros ou pesquisa no momento.
                </p>
                <Button variant="link" className="mt-4" onClick={() => {setFilter("todos"); setSearchTerm("");}}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 bg-muted/30 border-t flex items-center justify-between">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            HSM GESTÃO v4.2.0
          </span>
          <Button variant="link" size="sm" className="h-auto p-0 text-[10px] font-bold uppercase tracking-widest">
            <button 
              onClick={() => {
                // Fechar o sheet e navegar para a aba de arquivo na gestão do mural
                // Como não temos navegação direta por abas ainda, vamos apenas redirecionar
                window.location.href = '/administracao/mural?tab=arquivo';
              }}
              className="w-full text-left text-xs font-bold text-primary hover:underline"
            >
              Ver Arquivo Histórico
            </button>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

