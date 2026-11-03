import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Send } from "lucide-react";
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
import { toast } from "sonner";

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
type ProfissionalSemDias = {
  id?: string;
  nome: string;
  cargo?: string;
  setor?: string;
  detalhe?: string;
};

type SetorEnvioResumo = {
  id: string;
  nome: string;
  status: string;
  jaEnviado: boolean;
};

export function EnviarFolhaDialog({
  open,
  onOpenChange,
  competenciaId,
  unidadeId,
  folha,
  statusLinha,
  setorId,
  enviando,
  onConfirm,
  profissionaisSemDias = [],
  setoresEnvio,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  competenciaId: string | null | undefined;
  unidadeId: string | null | undefined;
  folha: "efetivos" | "contratados";
  statusLinha?: string;
  setorId?: string | null;
  enviando?: boolean;
  onConfirm: () => void;
  profissionaisSemDias?: ProfissionalSemDias[];
  setoresEnvio?: SetorEnvioResumo[];
}) {
  const obter = useServerFn(obterSubmissaoFolha);
  const descartar = useServerFn(descartarAnexosPendentes);
  const qc = useQueryClient();
  const pendentesRef = useRef<string[]>([]);
  const [descartando, setDescartando] = useState(false);
  const temProfissionaisSemDias = profissionaisSemDias.length > 0;
  const setoresJaEnviados = (setoresEnvio ?? []).filter((setor) => setor.jaEnviado).length;
  const temEnvioParcialSetorial =
    (setoresEnvio?.length ?? 0) > 0 &&
    setoresJaEnviados > 0 &&
    setoresJaEnviados < (setoresEnvio?.length ?? 0);

  const { data: submissaoId, isFetching } = useQuery({
    queryKey: ["submissao-folha", competenciaId, unidadeId, setorId],
    enabled: open && !!competenciaId && !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      (await obter({ data: { competencia_id: competenciaId!, unidade_id: unidadeId!, setor_id: setorId ?? undefined } }))
        .submissao_id,
  });

  const fechar = useCallback(
    async (proximo: boolean, preservarAnexosPendentes = false) => {
      if (proximo) {
        onOpenChange(true);
        return;
      }
      if (!preservarAnexosPendentes) {
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

        {temProfissionaisSemDias && (
          <section
            role="status"
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Atenção: {profissionaisSemDias.length} {profissionaisSemDias.length === 1 ? "profissional" : "profissionais"} com dias zerados ou não preenchidos.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                  Esta listagem serve apenas para conferência e não bloqueia o envio. Se esses servidores realmente não tiveram frequência nesta competência, você pode prosseguir normalmente.
                </p>
              </div>
            </div>
            <details className="mt-2">
              <summary className="cursor-pointer select-none text-xs font-medium text-amber-800 hover:text-amber-950 dark:text-amber-200 dark:hover:text-amber-50">
                Conferir profissionais ({profissionaisSemDias.length})
              </summary>
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
                {profissionaisSemDias.map((profissional, index) => {
                  const detalhes = [
                    profissional.cargo ? `Cargo: ${profissional.cargo}` : null,
                    profissional.setor ? `Setor: ${profissional.setor}` : null,
                    profissional.detalhe,
                  ].filter(Boolean).join(" · ");
                  return (
                    <li
                      key={profissional.id ?? `${profissional.nome}-${index}`}
                      className="rounded-md bg-amber-100 dark:bg-black/20 px-2 py-1.5 text-xs"
                    >
                      <p className="font-medium text-amber-950 dark:text-amber-50">{profissional.nome}</p>
                      {detalhes && <p className="mt-0.5 text-amber-800 dark:text-amber-200/80">{detalhes}</p>}
                    </li>
                  );
                })}
              </ul>
            </details>
          </section>
        )}

        {temEnvioParcialSetorial && (
          <section className="rounded-lg border border-sky-500/30 bg-sky-50 p-3 text-sm text-sky-900 dark:bg-sky-500/10 dark:text-sky-100">
            <p className="font-semibold">
              Resumo dos setores: {setoresJaEnviados} de {setoresEnvio?.length} já enviados.
            </p>
            <p className="mt-1 text-xs text-sky-800 dark:text-sky-100/80">
              Somente os setores pendentes serão enviados agora. Os setores já enviados serão preservados.
            </p>
            <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pr-1">
              {(setoresEnvio ?? []).map((setor) => (
                <li key={setor.id} className="flex items-start gap-2 rounded-md bg-sky-100 dark:bg-black/20 px-2 py-1.5">
                  {setor.jaEnviado ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  ) : (
                    <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{setor.nome}</p>
                    <p className={setor.jaEnviado ? "text-xs text-emerald-700 dark:text-emerald-200" : "text-xs text-amber-700 dark:text-amber-200"}>
                      {setor.jaEnviado ? "Já enviado para análise" : "Será enviado agora"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

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
              setorId={setorId}
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
            onClick={() => void fechar(false, temProfissionaisSemDias)}
            disabled={enviando || descartando}
          >
            {descartando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {temProfissionaisSemDias ? "Revisar folha" : "Cancelar"}
          </Button>
          <Button
            onClick={() => {
              const validos = ["rascunho", "enviada", "aprovada", "rejeitada", "com_pendencias", "devolvida", "em_analise", "arquivada"];
              if (statusLinha && !validos.includes(statusLinha)) {
                toast.error(`Status de linha inválido: "${statusLinha}". Por favor, recarregue a página.`);
                return;
              }
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
            {temEnvioParcialSetorial
              ? "Enviar setores pendentes"
              : temProfissionaisSemDias
                ? "Confirmar envio mesmo assim"
                : "Confirmar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EnviarFolhaDialog;
