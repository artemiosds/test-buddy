import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  AlertTriangle,
  Download,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/validar/$id")({
  head: () => ({
    meta: [
      { title: "Validação de Documento — SMS Oriximiná" },
      {
        name: "description",
        content:
          "Verifique a autenticidade de um documento emitido pela Secretaria Municipal de Saúde.",
      },
    ],
  }),
  component: ValidarPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Documento não encontrado.</div>,
});

function ValidarPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["validar-doc", id],
    queryFn: async () => {
      // Aceita tanto o identificador interno quanto o código impresso no PDF.
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const base = supabase
        .from("documentos_assinados")
        .select(
          "id, documento_tipo, descricao, hash_sha256, nome_assinante, assinado_em, status, revogado_em, motivo_revogacao, codigo_validacao, pdf_storage_path, metadata",
        );
      const { data, error } = await (uuidRe.test(id)
        ? base.eq("id", id)
        : base.eq("codigo_validacao", id)
      ).maybeSingle();
      if (error) throw error;

      if (!data) return null;

      const metadata = (data.metadata ?? {}) as Record<string, unknown>;

      return {
        id: data.id,
        tipo: data.documento_tipo,
        descricao:
          data.descricao ??
          ((metadata["filename"] as string | undefined) ??
            `${data.documento_tipo} — ${data.nome_assinante ?? "Sistema"}`),
        hash_conteudo: data.hash_sha256,
        assinado_por_nome: data.nome_assinante,
        assinado_em: data.assinado_em,
        status: data.status ?? "ativo",
        revogado_em: data.revogado_em,
        motivo_revogacao: data.motivo_revogacao,
        codigo_validacao: data.codigo_validacao,
        pdf_storage_path:
          data.pdf_storage_path ?? (metadata["pdf_storage_path"] as string | undefined) ?? null,
        timestamp_confiavel: (metadata["timestamp_confiavel"] as string | undefined) ?? null,
        termo_aceite: (metadata["termo_aceite"] as boolean | undefined) ?? true,
        metadata: data.metadata,
      };
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
      const storagePath = data?.pdf_storage_path;
      if (!storagePath) {
        toast.error("PDF original não disponível para este documento.");
        return;
      }
      const signed = await supabase.storage
        .from("documentos-assinados")
        .createSignedUrl(storagePath, 60);
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
    <div className="min-h-dvh bg-muted flex items-center justify-center p-4">
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
                <p className="font-semibold text-danger-soft-foreground">
                  Documento não encontrado
                </p>
                <p className="text-sm text-danger-soft-foreground">
                  O identificador informado não corresponde a nenhum documento emitido oficialmente.
                  Verifique o ID impresso no PDF ou solicite reemissão.
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
                      Revogado em{" "}
                      {data.revogado_em ? new Date(data.revogado_em).toLocaleString("pt-BR") : "—"}.
                      {data.motivo_revogacao ? ` Motivo: ${data.motivo_revogacao}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-md bg-success-soft border border-success/30 p-4">
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                  <div>
                    <p className="font-semibold text-success-soft-foreground">
                      Documento autêntico
                    </p>
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
                    <span className="ml-2 text-xs text-muted-foreground">
                      (timestamp confiável)
                    </span>
                  ) : null}
                </dd>

                <dt className="font-medium text-muted-foreground">Código de Validação</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-foreground break-all">
                  {(data as any).metadata?.codigo_validacao || (data as any).codigo_validacao || data.id}
                </dd>

                <dt className="font-medium text-muted-foreground">Identificador</dt>
                <dd className="sm:col-span-2 font-mono text-xs text-foreground break-all">
                  {data.id}
                </dd>

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
                    {new Date(data.timestamp_confiavel ?? data.assinado_em).toLocaleString("pt-BR")}
                    .
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
