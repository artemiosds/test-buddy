import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/auditoria")({
  component: () => <StubGerencial titulo="Auditoria" onda={4} itens={["Quem alterou cadastro / unidade / setor / cargo / função", "Quem alterou usuário", "Quem importou / recalculou Piso", "Quem excluiu informações", "Filtros por operação, tabela, usuário e período"]} />,
});