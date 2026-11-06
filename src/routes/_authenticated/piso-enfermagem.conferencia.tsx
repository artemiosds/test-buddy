import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PermissionGate } from "@/components/permission-gate";
import { Button } from "@/components/ui/button";
import { PisoConferenciaWizard } from "@/components/piso/piso-conferencia-wizard";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/conferencia")({
  errorComponent: ErrorComponent,
  component: () => (
    <PermissionGate permission="piso.importar" fallback={
      <p className="p-6 text-sm text-muted-foreground">Sem permissão para importar e conferir o Piso.</p>
    }>
      <main className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Conferência do Piso de Enfermagem</h1>
            <p className="text-muted-foreground text-sm">FOPAG + Prestadores + arquivo original do Ministério da Saúde</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/piso-enfermagem">Voltar</Link>
          </Button>
        </div>
        <PisoConferenciaWizard />
      </main>
    </PermissionGate>
  ),
});
