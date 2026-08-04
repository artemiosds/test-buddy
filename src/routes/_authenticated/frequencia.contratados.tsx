import { createFileRoute } from "@tanstack/react-router";
import { FrequenciasContratadosPage } from "@/components/frequencias/frequencias-contratados-page";
import { z } from "zod";

const SearchSchema = z.object({
  competenciaId: z.string().uuid().optional(),
  unidadeId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/frequencia/contratados")({
  validateSearch: (search) => SearchSchema.parse(search),
  component: FrequenciasContratadosPage,
});
