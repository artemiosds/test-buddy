import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HeartPulse, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPisoElegiveis } from "@/lib/piso-gestao.functions";
import { fmtBRL } from "@/components/piso/piso-detalhe-sheet";

/**
 * Faixa compacta com a situação do Piso da Enfermagem na competência,
 * exibida dentro das telas de Folha (Efetivos/Contratados).
 */
export function PisoFolhaResumo({ competencia }: { competencia?: string | null }) {
  const q = useQuery({
    queryKey: ["piso", "folha-resumo", competencia ?? null],
    queryFn: () =>
      listPisoElegiveis({
        data: { competencia: competencia ?? null, page: 1, pageSize: 1 },
      }),
  });

  const r = q.data?.resumo;
  if (!r || r.elegiveis === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <HeartPulse className="h-4 w-4 text-primary" />
        Piso da Enfermagem
      </div>
      <span className="text-muted-foreground">
        Elegíveis: <strong className="text-foreground">{r.elegiveis}</strong>
      </span>
      <span className="text-muted-foreground">
        Pendentes: <strong className="text-foreground">{r.pendentes}</strong>
      </span>
      <span className="text-muted-foreground">
        Divergências: <strong className="text-foreground">{r.divergentes}</strong>
      </span>
      <span className="text-muted-foreground">
        Complementação: <strong className="text-foreground">{fmtBRL(r.valorComplemento)}</strong>
      </span>
      <Button asChild variant="ghost" size="sm" className="ml-auto">
        <Link to="/piso-enfermagem">
          Abrir módulo <ArrowRight className="ml-1 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

export default PisoFolhaResumo;
