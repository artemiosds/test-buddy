import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { PermissionGate } from "@/components/permission-gate";
import { FolhaImportWizard } from "@/components/piso/folha-import-wizard";
import { LAYOUT_EFETIVOS } from "@/lib/piso-layouts";

export const Route = createFileRoute("/_authenticated/piso-enfermagem/importar-efetivos")({ errorComponent: ErrorComponent,
  component: () => (
    <PermissionGate
      permission="piso.importar"
      fallback={
        <div className="p-6 text-sm text-muted-foreground">
          Sem permissão para importar folhas do Piso Nacional da Enfermagem.
        </div>
      }
    >
      <FolhaImportWizard layout={LAYOUT_EFETIVOS} />
    </PermissionGate>
  ),
});
