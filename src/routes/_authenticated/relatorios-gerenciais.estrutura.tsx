import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/estrutura")({
  component: () => <StubGerencial titulo="Estrutura Organizacional" onda={3} itens={["Organograma Diretor → Coordenador → Profissionais", "Unidades e responsáveis", "Setores e responsáveis"]} />,
});