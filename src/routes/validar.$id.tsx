import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, ShieldCheck, AlertTriangle, Download, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/validar/$id")({
  head: () => ({
    meta: [
      { title: "Validação de Documento — SMS Oriximiná" },
      {
        name: "description",
        content: "Verifique a autenticidade de um documento emitido pela Secretaria Municipal de Saúde.",
      },
    ],
  }),
  component: ValidarPage,
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive">Erro: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Documento não encontrado.</div>,
});

function ValidarPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["validar-doc", id],
    queryFn: async () => {
      // Consulta a VIEW pública restrita — NÃO expõe dados_json nem outros campos sensíveis.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              maybeSingle: () => Promise<{
                data: {
                  id: string;
                  tipo: string;
                  descricao: string;
                  hash_conteudo: string;
                  assinado_por_nome: string | null;
                  assinado_em: string;
                  status: string | null;
                  revogado_em: string | null;
                  motivo_revogacao: string | null;
                  timestamp_confiavel: string | null;
                  termo_aceite: boolean | null;
                } | null;
                error: Error | null;
              }>;
            };
          };
        };
      })
        .from("documentos_assinados_publico")
        .select("id, tipo, descricao, hash_conteudo, assinado_por_nome, assinado_em, status, revogado_em, motivo_revogacao, timestamp_confiavel, termo_aceite")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [downloading, setDownloading] = useState(false);

  async function baixarPdfOriginal() {
    try {
      setDownloading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error("Faça login para baixar o PDF original.");
        return;
      }
      const { data: doc, error } = await supabase
        .from("documentos_assinados")
        .select("pdf_storage_path, assinado_por")
        .eq("id", id)
        .maybeSingle();
      if (error || !doc) {
        toast.error("Acesso restrito ao autor do documento.");
        return;
      }
      if (!doc.pdf_storage_path) {
        toast.error("PDF original não disponível para este documento.");
        return;
      }
      const signed = await supabase.storage
        .from("documentos-assinados")
        .createSignedUrl(doc.pdf_storage_path, 60);
      if (signed.error || !signed.data?.signedUrl) {
        toast.error("Não foi possível gerar o link de download.");
        return;
      }
      window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-card rounded-lg shadow-lg border overflow-hidden">
        <header className="bg-success text-success-foreground px-6 py-4 flex items-center gap-3">
          <ShieldCheck className="h-7 w-7" />
          <div>
            <h1 className="text-lg font-bold">Validação de Documento</h1>
            <p className="text-sm opacity-90">Prefeitura Municipal de Oriximiná — SMS</p>
          </div>
        </header>

        <div className="p-6 space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground">Consultando…</p>
          ) : !data ? (
            <div className="flex items-start gap-3 rounded-md bg-danger-soft border border-destructive/30 p-4">
              <XCircle className="h-6 w-6 text-destructive shrink-0" />
              <div>
                <p className="font-semibold text-danger-soft-foreground">Documento não encontrado</p>
                <p className="text-sm text-danger-soft-foreground">
                  O identificador informado não corresponde a nenhum documento emitido oficialmente. Verifique
                  o ID impresso no PDF ou solicite reemissão.
                </p>
              </div>
            </div>
          ) : (
            <>
              {data.status === "revogado" ? (
                <div className="flex items-start gap-3 rounded-md bg-danger-soft border border-destructive/30 p-4">
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
                  <div>
                    <p className="font-semibold text-danger-soft-foreground">Documento REVOGADO</p>
                    <p className="text-sm text-danger-soft-foreground">
                      Revogado em {data.revogado_em ? new Date(data.revogado_em).toLocaleString("pt-BR") : "—"}.
                      {data.motivo_revogacao ? ` Motivo: ${data.motivo_revogacao}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
              <div className="flex items-start gap-3 rounded-md bg-success-soft border border-success/30 p-4">
                <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                <div>
                  <p className="font-semibold text-success-soft-foreground">Documento autêntico</p>
                  <p className="text-sm text-success-soft-foreground">
                    Este documento consta como emitido oficialmente pela SMS de Oriximiná.
                  </p>
                </div>
              </div>
              )}

              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                <dt className="font-medium text-muted-foreground">Tipo</dt>
                <dd className="sm:col-span-2 text-foreground">{data.tipo}</dd>

                <dt className="font-medium text-muted-foreground">Descrição</dt>
                <dd className="sm:col-span-2 text-foreground">{data.descricao}</dd>

                <dt className="font-medium text-muted-foreground">Assinado por</dt>
                <dd className="sm:col-span-2 text-foreground">{data.assinado_por_nome ?? "—"}</dd>

                <dt className="font-medium text-muted-foreground">Emitido em</dt>
                <dd className="sm:col-span-2 text-foreground">
                  {new Date(data.timestamp_confiavel ?? data.assinado_em).toLocaleString("pt-BR")}
                  {data.timestamp_confiavel ? (
                    <span className="ml-2 text-xs text-muted-foreground">(timestamp confiável)</span>
                  ) : null}
                </dd>

                <dt className="font-medium text-muted-foreground">Identificador</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-foreground break-all">{data.id}</dd>

                <dt className="font-medium text-muted-foreground">Hash SHA-256</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-foreground break-all">
                  {data.hash_conteudo}
                </dd>
              </dl>

              {data.termo_aceite ? (
                <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                  <ScrollText className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Termo de responsabilidade aceito pelo signatário em{" "}
                    {new Date(data.timestamp_confiavel ?? data.assinado_em).toLocaleString("pt-BR")}.
                  </span>
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  onClick={baixarPdfOriginal}
                  disabled={downloading}
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Gerando link..." : "Baixar PDF original"}
                </button>
                <p className="mt-1 text-xs text-muted-foreground">
                  Disponível apenas para o autor do documento ou administrador Master.
                </p>
              </div>
            </>
          )}

          <div className="pt-4 border-t text-xs text-muted-foreground">
            <Link to="/" className="text-success hover:underline">
              ← Voltar ao portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
