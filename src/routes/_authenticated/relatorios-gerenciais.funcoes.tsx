import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/funcoes")({
  component: () => <StubGerencial titulo="Funções" onda={2} itens={["Relação de Funções", "Quantidade por Função", "Funções sem profissionais"]} />,
});