import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SistemasExternosGrid } from "@/components/sistemas-externos/SistemasExternosGrid";
import { Globe, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SistemaExternoDialog } from "@/components/sistemas-externos/SistemaExternoDialog";
import { GeradorChavesSSO } from "@/components/sistemas-externos/GeradorChavesSSO";


export const Route = createFileRoute("/_authenticated/administracao/sistemas-externos")({
  component: SistemasExternosPage,
});

function SistemasExternosPage() {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-8 w-8 text-primary" />
            Sistemas Externos
          </h2>
          <p className="text-muted-foreground">
            Integração centralizada via SSO para ecossistema de saúde.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GeradorChavesSSO />
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Sistema
          </Button>

        </div>
      </div>

      <div className="mt-6">
        <SistemasExternosGrid />
      </div>

      <SistemaExternoDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </div>
  );
}
