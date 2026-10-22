import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute } from "@tanstack/react-router";
import { FrequenciasEfetivosPage } from "@/components/frequencias/frequencias-efetivos-page";
import { z } from "zod";

const SearchSchema = z.object({
  competenciaId: z.string().uuid().optional(),
  unidadeId: z.string().uuid().optional(),
  setorId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/frequencia/efetivos")({ errorComponent: ErrorComponent,
  head: () => ({ meta: [
    { title: "Folha de Efetivos | Gestão Saúde Oriximiná" },
    { name: "description", content: "Frequência e folha dos servidores efetivos da SMS Oriximiná." },
    { property: "og:title", content: "Folha de Efetivos | Gestão Saúde Oriximiná" },
    { property: "og:description", content: "Frequência e folha dos servidores efetivos da SMS Oriximiná." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  validateSearch: (search) => SearchSchema.parse(search),
  component: FrequenciasEfetivosPage,
});
