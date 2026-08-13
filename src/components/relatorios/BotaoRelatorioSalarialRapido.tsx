import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-permissions";

export function BotaoRelatorioSalarialRapido() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Verifica permissão (pode ajustar o campo conforme a regra de negócio real)
  const hasAccess = user.data?.perfil_codigo === "MASTER" || user.data?.perfil_codigo === "GESTOR";

  if (!hasAccess) return null;

  return (
    <Button 
      variant="default" 
      className="gap-2 bg-blue-600 hover:bg-blue-700"
      onClick={() => {
        navigate({ to: "/relatorio-inteligente", search: { mode: "salarial_rapido" } });
      }}
    >
      <Zap className="h-4 w-4" /> Relatório Salarial Rápido
    </Button>
  );
}
