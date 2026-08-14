import { createFileRoute } from "@tanstack/react-router";
import { RelatorioInteligentePage } from "./relatorio-inteligente";
import { z } from "zod";

export const Route = createFileRoute(
  "/_authenticated/relatorios-gerenciais/salarios",
)({
  validateSearch: (search) =>
    z
      .object({
        mode: z.string().optional(),
      })
      .catch({ mode: "salarios" }),
  component: () => <RelatorioInteligentePage mode="salarios" />,
});
