import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, CalendarClock, LayoutGrid, Shield, Globe, Terminal, Edit, Trash2, Copy, MoreVertical } from "lucide-react";
import { testarConfiguracaoSSO, gerarTokenSSO } from "@/lib/sso.functions";
import { removerSistema, duplicarSistema } from "@/lib/sistemas-externos-admin.functions";
import { toast } from "sonner";
import { SistemaExternoDialog } from "./SistemaExternoDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const ICON_MAP: Record<string, any> = {
  CalendarClock,
  LayoutGrid,
  Shield,
  Globe,
};

export function SistemasExternosGrid() {
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectedSistema, setSelectedSistema] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: sistemas, isLoading } = useQuery({
    queryKey: ["sistemas-externos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sistemas_externos")
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const handleTestConfig = async (sistema: any) => {
    const toastId = toast.loading(`Testando configuração de ${sistema.nome}...`);
    try {
      const result = await testarConfiguracaoSSO({ data: { sistemaId: sistema.id } });
      
      if (result.erroGeral) {
        toast.error(`${sistema.nome}: Falha crítica`, {
          id: toastId,
          description: result.erroGeral
        });
        return;
      }

      const falhas = result.passos.filter((p: any) => !p.status && !p.aviso);
      const avisos = result.passos.filter((p: any) => p.aviso);
      
      if (falhas.length > 0) {
        toast.error(`${sistema.nome}: ${falhas.length} inconsistência(s)`, {
          id: toastId,
          description: falhas.map((f: any) => `${f.nome}: ${f.mensagem}`).join(" | ")
        });
      } else if (avisos.length > 0) {
        toast.warning(`${sistema.nome}: Conectividade limitada`, {
          id: toastId,
          description: avisos.map((f: any) => f.mensagem).join(" | ")
        });
      } else {
        toast.success("Arquitetura ponta a ponta validada com sucesso!", { id: toastId });
      }
      console.log("Diagnóstico SSO:", result);
    } catch (error: any) {
      toast.error("Erro ao executar diagnóstico: " + error.message, { id: toastId });
    }
  };

  const handleOpenSystem = async (sistema: any) => {
    setOpeningId(sistema.id);
    try {
      const result = await gerarTokenSSO({
        data: { sistemaId: sistema.id }
      });

      if (result && 'error' in result && result.error) {
        toast.error(result.error);
        return;
      }

      if (result?.token && result?.urlRedirect) {
        const sistemaTarget = result.urlRedirect;
        let formattedUrl = sistemaTarget;
        
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
          formattedUrl = `https://${formattedUrl}`;
        }

        try {
          const targetUrl = new URL(formattedUrl);
          targetUrl.searchParams.set('token', result.token);
          window.open(targetUrl.toString(), "_blank");
        } catch (e) {
          console.error("Invalid URL construction:", e);
          // Fallback simple concatenation if URL parsing fails for some reason
          window.open(formattedUrl, "_blank");
        }
      }
    } catch (error: any) {
      console.error("SSO Error:", error);
      toast.error("Falha ao gerar acesso automático: " + (error.message || "Erro desconhecido"));
    } finally {
      setOpeningId(null);
    }
  };


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return removerSistema({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sistemas-externos"] });
      toast.success("Sistema removido com sucesso");
    },
    onError: (error: any) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      return duplicarSistema({ data: { id } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sistemas-externos"] });
      toast.success("Sistema duplicado!");
    },
    onError: (error: any) => {
      toast.error("Erro ao duplicar: " + error.message);
    },
  });

  const handleEdit = (sistema: any) => {
    setSelectedSistema(sistema);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este sistema?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sistemas || sistemas.length === 0) {
    return (
      <div className="text-center p-12 bg-muted/30 rounded-lg border-2 border-dashed">
        <p className="text-muted-foreground">Nenhum sistema externo configurado.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sistemas.map((sistema) => {
          const Icon = ICON_MAP[sistema.icone || "Globe"] || Globe;
          return (
            <Card key={sistema.id} className="overflow-hidden border-t-4 transition-all hover:shadow-lg" style={{ borderTopColor: sistema.cor || '#3b82f6' }}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="h-6 w-6" style={{ color: sistema.cor }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={sistema.ativo ? "default" : "secondary"}>
                      {sistema.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(sistema)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(sistema.id)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(sistema.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <CardTitle className="mt-4">{sistema.nome}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">
                  {sistema.descricao}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  <span>Tipo: {sistema.tipo_autenticacao || "JWT SSO (Padrão)"}</span>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button 
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 border-dashed"
                  onClick={() => handleTestConfig(sistema)}
                >
                  <Terminal className="h-4 w-4" />
                  Testar SSO
                </Button>
                <Button 
                  className="w-full gap-2" 
                  onClick={() => handleOpenSystem(sistema)}
                  disabled={openingId === sistema.id}
                >
                  {openingId === sistema.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Abrir Sistema
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <SistemaExternoDialog 
        open={dialogOpen} 
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setSelectedSistema(null);
        }}
        sistema={selectedSistema}
      />
    </>
  );
}
