import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/cargos")({
  component: () => <StubGerencial titulo="Cargos" onda={2} itens={["Relação de Cargos", "Quantidade de profissionais por cargo", "Cargos sem profissionais", "Cargos mais utilizados"]} />,
});