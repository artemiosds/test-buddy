import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { ProfessionalFilterProvider } from "@/context/professional-filter-context";
import ProfessionalsPage from "@/components/profissionais/ProfessionalsPage";

export const Route = createFileRoute("/_authenticated/gestao-profissionais")({ errorComponent: ErrorComponent,
  component: () => (
    <ProfessionalFilterProvider>
      <ProfessionalsPage />
    </ProfessionalFilterProvider>
  ),
});
