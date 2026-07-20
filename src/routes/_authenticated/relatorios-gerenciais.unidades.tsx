import { createFileRoute } from "@tanstack/react-router";
import { StubGerencial } from "@/components/relatorios-gerenciais-stub";

export const Route = createFileRoute("/_authenticated/relatorios-gerenciais/unidades")({
  component: () => <StubGerencial titulo="Unidades" onda={2} itens={["Relação geral", "Por Tipo (Hospital/UBS/CAPS/…)", "Ativas / Inativas", "Sem Diretor", "Sem Coordenador", "Sem Telefone / Sem CNES / Sem CNPJ / Sem E-mail", "Quantidade de servidores por unidade", "Lotação da Unidade (servidor / cargo / função / setor / status)"]} />,
});