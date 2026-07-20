import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/setores")({
  component: () => <StubGerencial titulo="Setores" onda={2} itens={["Relação geral", "Por Unidade", "Sem Coordenador", "Sem Profissionais", "Com apenas 1 servidor", "Distribuição por Setor"]} />,
});