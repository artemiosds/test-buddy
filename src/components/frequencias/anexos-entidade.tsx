import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, ImageIcon, Loader2, Paperclip, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/use-permissions";
import {
  registrarAnexoLinha,
  removerAnexoLinha,
  restaurarAnexoLinha,
  listarAnexosRemovidosLinha,
} from "@/lib/frequencias.functions";
import { listarAnexosLinha } from "@/lib/listar-anexos.functions";
import {
  ANEXO_ACCEPT,
  formatarBytes,
  montarCaminhoAnexo,
  validarArquivoAnexo,
  type TipoAnexoEntidade,
} from "@/lib/anexos-linha";

/**
 * Anexos de comprovação vinculados a uma entidade da folha.
 *
 * - `tipoEntidade="frequencia"`: anexos da LINHA (atestado, laudo, portaria…);
 * - `tipoEntidade="frequencia_submissao"`: anexos da SUBMISSÃO da folha
 *   (escalas, plantões extras, memorandos) usados na análise da aprovação.
 *
 * O arquivo vai sempre para o bucket privado `documentos`; na tabela
 * `documentos` gravamos apenas metadados + caminho. A visualização usa URL
 * assinada de curta duração (5 min), gerada no servidor.
 */
export function AnexosEntidade({
  entidadeId,
  tipoEntidade = "frequencia",
  subtipo,
  unidadeId,
  setorId,
  canEdit = true,
  titulo = "Documentos anexados",
  mensagemSemEntidade = "Salve a folha antes de anexar documentos.",
  mostrarLixeira = true,
  onUploaded,
  onRemoved,
}: {
  entidadeId: string | null | undefined;
  tipoEntidade?: TipoAnexoEntidade;
  /** Recorte dentro da entidade (ex.: "efetivos" | "contratados"). */
  subtipo?: string;
  unidadeId: string | null | undefined;
  setorId?: string | null;
  canEdit?: boolean;
  titulo?: string;
  mensagemSemEntidade?: string;
  mostrarLixeira?: boolean;
  /** Chamado a cada anexo enviado (id do registro em `documentos`). */
  onUploaded?: (documentoId: string) => void;
  /** Chamado quando um anexo é removido da listagem ativa. */
  onRemoved?: (documentoId: string) => void;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verLixeira, setVerLixeira] = useState(false);

  const alvoId = entidadeId ?? null;
  const listar = useServerFn(listarAnexosLinha);
  const registrar = useServerFn(registrarAnexoLinha);
  const remover = useServerFn(removerAnexoLinha);
  const listarRemovidos = useServerFn(listarAnexosRemovidosLinha);
  const restaurar = useServerFn(restaurarAnexoLinha);
  const { has } = usePermissions();
  const podeVerLixeira = mostrarLixeira && has("documento.excluir");

  const chave = ["anexos-entidade", tipoEntidade, subtipo ?? null, alvoId, setorId ?? null] as const;
  const chaveLixeira = [
    "anexos-entidade-lixeira",
    tipoEntidade,
    subtipo ?? null,
    alvoId,
    setorId ?? null,
  ] as const;

  const { data: secretariaId } = useQuery({
    queryKey: ["unidade-secretaria", unidadeId],
    enabled: !!unidadeId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidades")
        .select("secretaria_id")
        .eq("id", unidadeId!)
        .maybeSingle();
      if (error) throw error;
      return (data?.secretaria_id as string | null) ?? null;
    },
  });

  const {
    data: anexos,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: chave,
    enabled: !!alvoId,
    queryFn: async () =>
      (await listar({ data: { entidade_id: alvoId!, tipo_entidade: tipoEntidade, subtipo, setor_id: setorId ?? undefined } }))
        .anexos,
  });

  const { data: removidos, isFetching: carregandoLixeira } = useQuery({
    queryKey: chaveLixeira,
    enabled: !!alvoId && podeVerLixeira && verLixeira,
    queryFn: async () =>
      (
        await listarRemovidos({
          data: { entidade_id: alvoId!, tipo_entidade: tipoEntidade, subtipo, setor_id: setorId ?? undefined },
        })
      ).anexos,
  });

  const mRemover = useMutation({
    mutationFn: async (id: string) => {
      await remover({ data: { documento_id: id } });
      return id;
    },
    onSuccess: (id) => {
      toast.success("Anexo movido para a lixeira (arquivo preservado).");
      onRemoved?.(id);
      qc.invalidateQueries({ queryKey: chave });
      qc.invalidateQueries({ queryKey: chaveLixeira });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Falha ao remover o anexo."),
  });

  const mRestaurar = useMutation({
    mutationFn: async (id: string) => restaurar({ data: { documento_id: id } }),
    onSuccess: () => {
      toast.success("Anexo restaurado.");
      qc.invalidateQueries({ queryKey: chave });
      qc.invalidateQueries({ queryKey: chaveLixeira });
    },
    onError: (e: unknown) => toast.error((e as Error)?.message ?? "Falha ao restaurar o anexo."),
  });

  async function enviarArquivos(files: FileList | null) {
    if (!files?.length || !alvoId) return;
    if (!unidadeId || !secretariaId) {
      toast.error("Unidade sem secretaria vinculada — não é possível anexar.");
      return;
    }
    setEnviando(true);
    try {
      for (const file of Array.from(files)) {
        const check = validarArquivoAnexo(file);
        if (!check.ok) {
          toast.error(`${file.name}: ${check.erro}`);
          continue;
        }
        const path = montarCaminhoAnexo({
          secretariaId,
          unidadeId,
          entidadeId: alvoId,
          tipoEntidade,
          mime: check.mime,
        });
        const { error: upErr } = await supabase.storage
          .from("documentos")
          .upload(path, file, { contentType: check.mime, upsert: false });
        if (upErr) throw new Error(upErr.message);
        const res = await registrar({
          data: {
            entidade_id: alvoId,
            tipo_entidade: tipoEntidade,
            subtipo,
            setor_id: setorId ?? undefined,
            unidade_id: unidadeId,
            secretaria_id: secretariaId,
            nome: file.name.slice(0, 255),
            storage_path: path,
            mime_type: check.mime,
            tamanho_bytes: file.size,
          },
        });
        if (res?.id) onUploaded?.(res.id);
      }
      toast.success("Anexo(s) enviado(s).");
      await refetch();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Falha ao enviar o anexo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const labelStyle = {
    color: "#475569",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  };

  return (
    <section>
      <div style={labelStyle} className="mb-2 flex items-center gap-1">
        <Paperclip className="h-3.5 w-3.5" /> {titulo}
      </div>

      {!alvoId ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600">
          {mensagemSemEntidade}
        </p>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-300">
            {isFetching && !anexos ? (
              <div className="flex items-center gap-2 p-3 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando anexos…
              </div>
            ) : !anexos?.length ? (
              <p className="p-3 text-xs text-slate-500">Nenhum documento anexado.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {anexos.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 p-2">
                    {a.mime_type === "application/pdf" ? (
                      <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-slate-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-slate-800">{a.nome}</div>
                      <div className="text-[11px] text-slate-500">
                        {formatarBytes(a.tamanho_bytes)}
                        {a.created_at
                          ? ` · ${new Date(a.created_at).toLocaleDateString("pt-BR")}`
                          : ""}
                        {a.enviado_por ? ` · ${a.enviado_por}` : ""}
                      </div>
                    </div>
                    {a.url && (
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                        <a href={a.url} target="_blank" rel="noreferrer">
                          Ver
                        </a>
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive"
                        disabled={mRemover.isPending}
                        onClick={() => mRemover.mutate(a.id)}
                        aria-label={`Remover ${a.nome}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ANEXO_ACCEPT}
                className="hidden"
                onChange={(e) => enviarArquivos(e.target.files)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
              >
                {enviando ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="mr-1 h-3.5 w-3.5" />
                )}
                {enviando ? "Enviando…" : "Anexar documento"}
              </Button>
              <span className="text-[11px] text-slate-500">
                PDF, JPG, PNG ou WEBP — até 10 MB por arquivo.
              </span>
            </div>
          )}

          {podeVerLixeira && (
            <div className="rounded-md border border-dashed border-slate-300 bg-slate-50">
              <button
                type="button"
                className="flex w-full items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600"
                onClick={() => setVerLixeira((v) => !v)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {verLixeira ? "Ocultar lixeira" : "Ver removidos (lixeira)"}
              </button>
              {verLixeira && (
                <div className="border-t border-slate-200 px-3 py-2">
                  {carregandoLixeira && !removidos ? (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                    </div>
                  ) : !removidos?.length ? (
                    <p className="text-xs text-slate-500">Nenhum anexo removido.</p>
                  ) : (
                    <ul className="divide-y divide-slate-200">
                      {removidos.map((a) => (
                        <li key={a.id} className="flex items-center gap-2 py-2">
                          {a.mime_type === "application/pdf" ? (
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          ) : (
                            <ImageIcon className="h-4 w-4 shrink-0 text-slate-400" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-slate-600 line-through">
                              {a.nome}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatarBytes(a.tamanho_bytes)}
                              {a.purga_apos
                                ? ` · guardado até ${new Date(a.purga_apos).toLocaleDateString("pt-BR")}`
                                : ""}
                            </div>
                          </div>
                          {a.url && (
                            <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                              <a href={a.url} target="_blank" rel="noreferrer">
                                Ver
                              </a>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={mRestaurar.isPending}
                            onClick={() => mRestaurar.mutate(a.id)}
                          >
                            {mRestaurar.isPending ? (
                              <RotateCcw className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Undo2 className="mr-1 h-3.5 w-3.5" />
                            )}
                            Restaurar
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default AnexosEntidade;
