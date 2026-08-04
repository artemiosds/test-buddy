import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";
import { garantirLinhaFolha } from "@/lib/frequencia-linha.functions";

/**
 * Anexos de comprovação da LINHA de folha (atestado, laudo, portaria…).
 *
 * Se a linha ainda não existe no banco (usuário não salvou), a linha é criada
 * automaticamente em rascunho para permitir o anexo individual.
 */
export function LinhaAnexos({
  frequenciaProfissionalId,
  unidadeId,
  canEdit = true,
  competenciaId,
  profissionalId,
  folha,
}: {
  frequenciaProfissionalId: string | null | undefined;
  unidadeId: string | null | undefined;
  canEdit?: boolean;
  /** Necessários para criar a linha automaticamente quando ela não existe. */
  competenciaId?: string | null;
  profissionalId?: string | null;
  folha?: "efetivos" | "contratados";
}) {
  const garantir = useServerFn(garantirLinhaFolha);
  const [idCriado, setIdCriado] = useState<string | null>(null);

  useEffect(() => {
    setIdCriado(null);
  }, [profissionalId, competenciaId, unidadeId]);

  const mGarantir = useMutation({
    mutationFn: async () =>
      garantir({
        data: {
          competencia_id: competenciaId!,
          unidade_id: unidadeId!,
          profissional_id: profissionalId!,
          folha: folha!,
        },
      }),
    onSuccess: (r) => setIdCriado(r.id),
    onError: (e: unknown) =>
      toast.error((e as Error)?.message ?? "Falha ao preparar a linha para anexos."),
  });

  const alvo = frequenciaProfissionalId ?? idCriado ?? null;
  const podeCriar =
    canEdit && !alvo && !!competenciaId && !!unidadeId && !!profissionalId && !!folha;

  useEffect(() => {
    if (podeCriar && !mGarantir.isPending && !mGarantir.isError) mGarantir.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [podeCriar]);

  if (!alvo && podeCriar) {
    return (
      <p className="flex items-center gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando a linha para anexos…
      </p>
    );
  }

  return (
    <AnexosEntidade
      entidadeId={alvo}
      tipoEntidade="frequencia"
      unidadeId={unidadeId}
      canEdit={canEdit}
      mensagemSemEntidade="Salve a folha desta linha antes de anexar documentos."
    />
  );
}

export default LinhaAnexos;
