/**
 * Atalhos para os dois relatórios oficiais disponíveis nos painéis de IA
 * (HSM Expert e Inteligência dos Relatórios Gerenciais).
 */
import { Link } from "@tanstack/react-router";
import { FileText, Sparkles } from "lucide-react";

const RELATORIOS = [
  {
    to: "/relatorio-inteligente",
    titulo: "Relatório Geral Inteligente",
    descricao: "Blocos configuráveis, parecer técnico e exportação ABNT.",
    Icone: Sparkles,
  },
  {
    to: "/relatorios-gerenciais/geral-cargos",
    titulo: "Relatório Geral de Cargos",
    descricao: "Quadro por cargo, unidade, setor e afastamentos.",
    Icone: FileText,
  },
] as const;

export function RelatoriosOficiaisLinks({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className={compacto ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}>
      {RELATORIOS.map(({ to, titulo, descricao, Icone }) => (
        <Link
          key={to}
          to={to}
          className="flex items-start gap-2 rounded-lg border bg-card p-3 transition hover:border-primary/40"
        >
          <Icone className="mt-0.5 size-4 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{titulo}</span>
            <span className="block text-xs text-muted-foreground">{descricao}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
