import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/piso")({
  component: () => <StubGerencial titulo="Piso da Enfermagem (visão gerencial)" onda={3} itens={["Piso Efetivos / Contratados", "Comparativo entre meses", "Profissionais sem cálculo", "Divergências encontradas", "Valores importados / Histórico de importações", "Resumo financeiro do piso", "Conferência por unidade / profissional", "Log de atualizações"]} />,
});