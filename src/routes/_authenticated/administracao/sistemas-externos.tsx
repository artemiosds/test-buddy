import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SistemasExternosGrid } from "@/components/sistemas-externos/SistemasExternosGrid";
import { Globe, Plus, History, LayoutDashboard } from "lucide-react";
import { OfflineButton } from "@/components/shared/OfflineButton";
import { SistemaExternoDialog } from "@/components/sistemas-externos/SistemaExternoDialog";
import { GeradorChavesSSO } from "@/components/sistemas-externos/GeradorChavesSSO";
import { AuditSSOView } from "@/components/sistemas-externos/AuditSSOView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/_authenticated/administracao/sistemas-externos")({ errorComponent: ErrorComponent,
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
            Ecossistema de Saúde
          </h2>
          <p className="text-muted-foreground">
            Integração Centralizada & SSO — Secretaria Municipal de Saúde de Oriximiná.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <GeradorChavesSSO />
          <OfflineButton size="sm" onClick={() => setDialogOpen(true)} requireOnline>
            <Plus className="mr-2 h-4 w-4" />
            Novo Sistema
          </OfflineButton>
        </div>
      </div>

      <Tabs defaultValue="grid" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Sistemas
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Auditoria SSO
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-4">
          <SistemasExternosGrid />
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <AuditSSOView />
        </TabsContent>
      </Tabs>

      <SistemaExternoDialog 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </div>
  );
}
