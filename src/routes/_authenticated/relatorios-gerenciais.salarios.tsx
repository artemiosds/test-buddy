import { createFileRoute } from "@tanstack/react-router";
import { RelatorioInteligentePage } from "./relatorio-inteligente";

export const Route = createFileRoute(
  "/_authenticated/relatorios-gerenciais/salarios",
)({
  component: () => <RelatorioInteligentePage mode="salarios" />,
});