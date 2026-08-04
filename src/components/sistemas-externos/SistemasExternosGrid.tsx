import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Loader2, CalendarClock, LayoutGrid, Shield, Globe } from "lucide-react";
import { gerarTokenSSO } from "@/lib/sso.functions";
import { toast } from "sonner";

const ICON_MAP: Record<string, any> = {
  CalendarClock,
  LayoutGrid,
  Shield,
  Globe,
};

export function SistemasExternosGrid() {
  const [openingId, setOpeningId] = useState<string | null>(null);

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

  const handleOpenSystem = async (sistema: any) => {
    setOpeningId(sistema.id);
    try {
      const result = await gerarTokenSSO({ data: { sistemaId: sistema.id } });
      if (result.urlRedirect) {
        window.open(result.urlRedirect, "_blank");
      }
    } catch (error: any) {
      console.error("SSO Error:", error);
      toast.error("Falha ao gerar acesso automático: " + (error.message || "Erro desconhecido"));
    } finally {
      setOpeningId(null);
    }
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
                <Badge variant={sistema.status === "Ativo" ? "default" : "secondary"}>
                  {sistema.status}
                </Badge>
              </div>
              <CardTitle className="mt-4">{sistema.nome}</CardTitle>
              <CardDescription className="line-clamp-2 min-h-[40px]">
                {sistema.descricao}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                <span>Tipo: {sistema.tipo_autenticacao}</span>
              </div>
            </CardContent>
            <CardFooter>
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
  );
}
