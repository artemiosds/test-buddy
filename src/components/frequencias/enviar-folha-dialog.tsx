import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AnexosEntidade } from "@/components/frequencias/anexos-entidade";
import { obterSubmissaoFolha } from "@/lib/folha-submissao.functions";
import { descartarAnexosPendentes } from "@/lib/frequencias.functions";

/**
 * Confirmação do envio da folha para aprovação, com o bloco opcional de
 * "Documentos de Justificativa" (escala, plantões extras, atestados, memorandos).
 *
 * Os documentos ficam vinculados à SUBMISSÃO (competência + unidade + vínculo),
 * reutilizando a tabela `documentos` e o bucket privado `documentos`.
 * Enviar sem nenhum anexo é permitido.
 *
 * Cancelar o modal descarta definitivamente os anexos enviados NESTA sessão
 * (registro + binário no Storage), para não deixar rascunhos órfãos.
 */
export function EnviarFolhaDialog({
  open,
  onOpenChange,
  competenciaId,
  unidadeId,
  folha,
  enviando,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  competenciaId: string | null | undefined;
  unidadeId: string | null | undefined;
  folha: "efetivos" | "contratados";
  enviando?: boolean;
  onConfirm: () => void;
}) {
  const obter = useServerFn(obterSubmissaoFolha);
  const descartar = useServerFn(descartarAnexosPendentes);
  const qc = useQueryClient();
  const pendentesRef = useRef<string[]>([]);
  const [descartando, setDescartando] = useState(false);

  const { data: submissaoId, isFetching } = useQuery({
    queryKey: ["submissao-folha", competenciaId, unidadeId],
    enabled: open && !!competenciaId && !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await obter({ data: { competencia_id: competenciaId!, unidade_id: unidadeId! } }))
        .submissao_id,
  });

  const fechar = useCallback(
    async (proximo: boolean) => {
      if (proximo) {
        onOpenChange(true);
        return;
      }
      const ids = pendentesRef.current;
      pendentesRef.current = [];
      if (ids.length) {
        setDescartando(true);
        try {
          await descartar({ data: { documento_ids: ids } });
          qc.invalidateQueries({ queryKey: ["anexos-entidade"] });
        } catch {
          // Falha no descarte não deve travar o fechamento do modal;
          // o anexo continua visível e pode ser removido manualmente.
        } finally {
          setDescartando(false);
        }
      }
      onOpenChange(false);
    },
    [descartar, onOpenChange, qc],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => void fechar(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar folha para aprovação</DialogTitle>
          <DialogDescription>
            Anexe, se quiser, os documentos que justificam os lançamentos desta folha (escala de
            plantão, plantões extras, atestados, memorandos). O envio funciona normalmente mesmo sem
            anexos. Se você cancelar, os arquivos enviados agora serão descartados.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto pr-1">
          {isFetching && !submissaoId ? (
            <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Preparando anexos…
            </div>
          ) : (
            <AnexosEntidade
              entidadeId={submissaoId}
              tipoEntidade="frequencia_submissao"
              subtipo={folha}
              unidadeId={unidadeId}
              titulo="Documentos de justificativa"
              mensagemSemEntidade="Selecione competência e unidade para anexar documentos."
              mostrarLixeira={false}
              onUploaded={(id) => {
                pendentesRef.current = [...pendentesRef.current, id];
              }}
              onRemoved={(id) => {
                pendentesRef.current = pendentesRef.current.filter((x) => x !== id);
              }}
            />
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => void fechar(false)}
            disabled={enviando || descartando}
          >
            {descartando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Cancelar
          </Button>
          <Button
            onClick={() => {
              pendentesRef.current = [];
              onConfirm();
            }}
            disabled={enviando || descartando}
          >
            {enviando ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnviarFolhaDialog;
