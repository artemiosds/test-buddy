import { createFileRoute } from "@tanstack/react-router";
import { FrequenciasContratadosPage } from "@/components/frequencias/frequencias-contratados-page";

export const Route = createFileRoute("/_authenticated/frequencia/contratados")({
  component: FrequenciasContratadosPage,
});
