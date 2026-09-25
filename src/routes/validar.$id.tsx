import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, FileWarning, ShieldCheck, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicDocumentValidation } from "@/lib/document-validation.functions";

export const Route = createFileRoute("/validar/$id")({
  head: () => ({
    meta: [
      { title: "Validar Documento | Gestão Saúde Oriximiná" },
      { name: "description", content: "Consulte a autenticidade e a situação de um documento emitido pela Secretaria Municipal de Saúde de Oriximiná." },
      { property: "og:title", content: "Validar Documento | Gestão Saúde Oriximiná" },
      { property: "og:description", content: "Consulta pública de autenticidade de documentos da Secretaria Municipal de Saúde de Oriximiná." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ValidarPage,
  errorComponent: () => <ValidationShell><p className="text-destructive">Não foi possível consultar o documento agora.</p></ValidationShell>,
  notFoundComponent: () => <ValidationShell><p>Documento não encontrado.</p></ValidationShell>,
});

type FileCheck = "idle" | "checking" | "match" | "different";

function ValidationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted p-4">
      <section className="w-full max-w-2xl overflow-hidden rounded-lg border bg-card shadow-lg">
        <header className="flex items-center gap-3 bg-primary px-6 py-5 text-primary-foreground">
          <ShieldCheck className="h-8 w-8" />
          <div>
            <h1 className="text-xl font-bold">Validação de Documento</h1>
            <p className="text-sm opacity-90">Prefeitura Municipal de Oriximiná — SMS</p>
          </div>
        </header>
        <div className="space-y-5 p-6">{children}</div>
      </section>
    </main>
  );
}

function ValidarPage() {
  const { id } = Route.useParams();
  const validateDocument = useServerFn(getPublicDocumentValidation);
  const [fileCheck, setFileCheck] = useState<FileCheck>("idle");
  const [fileName, setFileName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["validar-documento-publico", id],
    queryFn: () => validateDocument({ data: { code: id } }),
  });

  async function checkFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !data) return;
    setFileName(file.name);
    setFileCheck("checking");
    try {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      setFileCheck(hash.toLowerCase() === data.hash.toLowerCase() ? "match" : "different");
    } catch {
      setFileCheck("different");
    }
  }

  if (isLoading) return <ValidationShell><p className="text-muted-foreground">Consultando autenticidade…</p></ValidationShell>;
  if (!data) {
    return (
      <ValidationShell>
        <div className="flex gap-3 rounded-md border border-destructive/30 bg-danger-soft p-4">
          <XCircle className="h-6 w-6 shrink-0 text-destructive" />
          <div><p className="font-semibold text-danger-soft-foreground">Documento não encontrado</p><p className="text-sm text-danger-soft-foreground">Confira o código impresso no documento e tente novamente.</p></div>
        </div>
        <Link to="/api/public/validar-documento" className="text-sm font-medium text-primary hover:underline">Consultar outro código</Link>
      </ValidationShell>
    );
  }

  const revoked = data.status === "revogado";
  return (
    <ValidationShell>
      <div className={`flex gap-3 rounded-md border p-4 ${revoked ? "border-destructive/30 bg-danger-soft" : "border-success/30 bg-success-soft"}`}>
        {revoked ? <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" /> : <CheckCircle2 className="h-6 w-6 shrink-0 text-success" />}
        <div>
          <p className={`font-semibold ${revoked ? "text-danger-soft-foreground" : "text-success-soft-foreground"}`}>{revoked ? "Documento revogado" : "Documento autêntico"}</p>
          <p className={`text-sm ${revoked ? "text-danger-soft-foreground" : "text-success-soft-foreground"}`}>
            {revoked ? `Revogado em ${data.revogadoEm ? new Date(data.revogadoEm).toLocaleString("pt-BR") : "data não informada"}.${data.motivoRevogacao ? ` Motivo: ${data.motivoRevogacao}` : ""}` : "Este código consta nos registros oficiais da SMS de Oriximiná."}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <dt className="font-medium text-muted-foreground">Tipo</dt><dd className="text-foreground sm:col-span-2">{data.tipo}</dd>
        <dt className="font-medium text-muted-foreground">Descrição</dt><dd className="text-foreground sm:col-span-2">{data.descricao}</dd>
        <dt className="font-medium text-muted-foreground">Assinado por</dt><dd className="text-foreground sm:col-span-2">{data.nomeAssinante ?? "—"}</dd>
        <dt className="font-medium text-muted-foreground">Emitido em</dt><dd className="text-foreground sm:col-span-2">{new Date(data.assinadoEm).toLocaleString("pt-BR")}</dd>
        <dt className="font-medium text-muted-foreground">Código</dt><dd className="break-all font-mono text-xs text-foreground sm:col-span-2">{data.codigoValidacao}</dd>
        <dt className="font-medium text-muted-foreground">Hash SHA-256</dt><dd className="break-all font-mono text-xs text-foreground sm:col-span-2">{data.hash}</dd>
      </dl>

      <div className="space-y-3 border-t pt-5">
        <div>
          <h2 className="font-semibold text-foreground">Conferir o arquivo PDF</h2>
          <p className="text-sm text-muted-foreground">Selecione o PDF recebido. A conferência acontece neste dispositivo e o arquivo não é enviado.</p>
        </div>
        <Button asChild variant="outline">
          <label><Upload className="h-4 w-4" />Selecionar PDF<input className="sr-only" type="file" accept="application/pdf,.pdf" onChange={checkFile} /></label>
        </Button>
        {fileCheck !== "idle" ? (
          <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${fileCheck === "match" ? "border-success/30 bg-success-soft text-success-soft-foreground" : fileCheck === "different" ? "border-destructive/30 bg-danger-soft text-danger-soft-foreground" : "bg-muted text-muted-foreground"}`}>
            {fileCheck === "match" ? <FileCheck2 className="h-5 w-5 shrink-0" /> : <FileWarning className="h-5 w-5 shrink-0" />}
            <span>{fileCheck === "checking" ? "Conferindo o arquivo…" : fileCheck === "match" ? `${fileName}: arquivo íntegro e correspondente ao registro oficial.` : `${fileName}: o conteúdo não corresponde ao arquivo oficial.`}</span>
          </div>
        ) : null}
      </div>

      <div className="border-t pt-4 text-xs text-muted-foreground">
        <Link to="/api/public/validar-documento" className="font-medium text-primary hover:underline">Consultar outro código</Link>
      </div>
    </ValidationShell>
  );
}