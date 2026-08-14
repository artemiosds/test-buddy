import { createFileRoute } from "@tanstack/react-router";
import { RelatorioInteligentePage } from "./relatorio-inteligente";
import { z } from "zod";

export const Route = createFileRoute(
  "/_authenticated/relatorios-gerenciais/salarios",
)({
  validateSearch: (search: Record<string, unknown>): { mode?: string } => {
    return {
      mode: typeof search.mode === 'string' ? search.mode : (search.mode ?? "salarios") as string
    }
  },
  component: () => <RelatorioInteligentePage mode="salarios" />,
});