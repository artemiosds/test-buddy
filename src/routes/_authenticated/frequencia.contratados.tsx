import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { FrequenciasContratadosPage } from "@/components/frequencias/frequencias-contratados-page";
import { z } from "zod";

const SearchSchema = z.object({
  competenciaId: z.string().uuid().optional(),
  unidadeId: z.string().uuid().optional(),
  setorId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/frequencia/contratados")({ errorComponent: ErrorComponent,
  head: () => ({ meta: [
    { title: "Folha de Contratados | Gestão Saúde Oriximiná" },
    { name: "description", content: "Frequência e folha dos profissionais contratados da SMS Oriximiná." },
    { property: "og:title", content: "Folha de Contratados | Gestão Saúde Oriximiná" },
    { property: "og:description", content: "Frequência e folha dos profissionais contratados da SMS Oriximiná." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search) => SearchSchema.parse(search),
  component: FrequenciasContratadosPage,
});
