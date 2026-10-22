import { createFileRoute } from "@tanstack/react-router";
import { DashboardClassico } from "@/components/dashboard/DashboardClassico";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [
    { title: "Painel de Gestão | Saúde Oriximiná" },
    { name: "description", content: "Painel institucional da Secretaria Municipal de Saúde de Oriximiná." },
    { property: "og:title", content: "Painel de Gestão | Saúde Oriximiná" },
    { property: "og:description", content: "Painel institucional da Secretaria Municipal de Saúde de Oriximiná." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: DashboardClassico,
});