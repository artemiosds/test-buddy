import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { FrequenciasEfetivosPage } from "@/components/frequencias/frequencias-efetivos-page";

export const Route = createFileRoute("/_authenticated/frequencia/efetivos")({ errorComponent: ErrorComponent,
  component: FrequenciasEfetivosPage,
});
