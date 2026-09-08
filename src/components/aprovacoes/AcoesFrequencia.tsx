import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { OfflineButton } from "@/components/shared/OfflineButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  History,
  ListChecks,
  MoreVertical,
  ScanSearch,
  Upload,
  XCircle,
} from "lucide-react";
import type { AcoesHandlers, FreqRow } from "./tipos";

/** Ações de uma frequência: "Abrir" + menu "Mais ações" + decisões conforme permissão. */
export function AcoesFrequencia({ r, h }: { r: FreqRow; h: AcoesHandlers }) {
  const cu = r.competencia_unidades;
  const pendente = r.status === "enviada" || r.status === "em_analise";

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {r.tipo === "contratados" ? (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/frequencia/contratados"
            search={{
              competenciaId: cu?.competencia_id ?? undefined,
              unidadeId: cu?.unidade_id ?? undefined,
            }}
          >
            <Eye className="mr-1 h-4 w-4" />
            Abrir
          </Link>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link
            to="/frequencia/efetivos"
            search={{
              competenciaId: cu?.competencia_id ?? undefined,
              unidadeId: cu?.unidade_id ?? undefined,
              setorId: r.setor_id ?? undefined,
            }}
          >
            <Eye className="mr-1 h-4 w-4" />
            Abrir
          </Link>
        </Button>
      )}

      {pendente && h.canAnalisar && r.status === "enviada" && (
        <OfflineButton
          size="sm"
          variant="outline"
          onClick={() => h.onAcao(r.id, "em_analise")}
          requireOnline
        >
          <ScanSearch className="mr-1 h-4 w-4" />
          Analisar
        </OfflineButton>
      )}
      {pendente && h.canAprovar && (
        <OfflineButton size="sm" onClick={() => h.onAcao(r.id, "aprovar")} requireOnline>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Aprovar
        </OfflineButton>
      )}
      {pendente && h.canRejeitar && (
        <>
          <OfflineButton
            size="sm"
            variant="outline"
            onClick={() => h.onAcao(r.id, "retornar")}
            requireOnline
          >
            <ClipboardList className="mr-1 h-4 w-4" />
            Retornar
          </OfflineButton>
          <OfflineButton
            size="sm"
            variant="destructive"
            onClick={() => h.onAcao(r.id, "rejeitar")}
            requireOnline
          >
            <XCircle className="mr-1 h-4 w-4" />
            Rejeitar
          </OfflineButton>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" title="Mais ações">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => h.onAnexos(r)}>
            <Upload className="mr-2 h-4 w-4" />
            Anexos
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => h.onTrilha(r)}>
            <History className="mr-2 h-4 w-4" />
            Trilha de auditoria
          </DropdownMenuItem>
          {(h.canAprovar || h.canRejeitar) && (
            <DropdownMenuItem onSelect={() => h.onLinhas(r)}>
              <ListChecks className="mr-2 h-4 w-4" />
              Linhas
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default AcoesFrequencia;
