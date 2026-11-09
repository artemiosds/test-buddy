import type { FreqRow } from "./tipos";
import { auditarResumoAprovacoes } from "@/lib/auditoria-inteligente-folhas";
import { AlertTriangle, ClipboardCheck, FileWarning } from "lucide-react";

/** Resumo informativo dos registros atualmente exibidos na tela.
 * Não interfere nas ações de análise, aprovação ou rejeição.
 */
export function AuditoriaAprovacoesResumo({ folhas }: { folhas: readonly FreqRow[] }) {
  const dados = auditarResumoAprovacoes(folhas.map(f => ({
    id: f.id,
    competencia_unidade_id: f.competencia_unidade_id ?? "",
    tipo: f.tipo,
    setor_id: f.setor_id,
    status: f.status,
    total_profissionais: f.total_profissionais,
  })));
  return (
    <section className="rounded-xl border bg-card p-4 space-y-2" aria-label="Auditoria informativa das aprovações">
      <h3 className="flex items-center gap-2 font-semibold text-sm">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        Conferência inteligente — folhas exibidas
      </h3>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <strong className="block text-lg tabular-nums">{dados.avaliadas}</strong>
          Registros exibidos
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <strong className="block text-lg tabular-nums">{dados.aguardando}</strong>
          Para análise
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <strong className="block text-lg tabular-nums">{dados.correcao}</strong>
          Com correções
        </div>
        <div className="rounded-md bg-muted/40 p-2 text-xs">
          <strong className="block text-lg tabular-nums">{dados.semProfissionais}</strong>
          Sem profissionais informados
        </div>
      </div>
      {(dados.semProfissionais > 0 || dados.duplicadas > 0) && (
        <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {dados.semProfissionais > 0
            ? `${dados.semProfissionais} registro(s) enviado(s) sem profissionais contabilizados. Confira o conteúdo e a situação setorial.`
            : ""}
          {dados.duplicadas > 0
            ? ` ${dados.duplicadas} identificador(es) repetido(s) na listagem; verifique a consulta.`
            : ""}
        </p>
      )}
      <p className="flex gap-2 text-xs text-muted-foreground">
        <FileWarning className="h-3.5 w-3.5 shrink-0" />
        Conferência baseada na listagem carregada e nos filtros atuais. Não substitui a validação individual e não altera as regras de aprovação.
      </p>
    </section>
  );
}
