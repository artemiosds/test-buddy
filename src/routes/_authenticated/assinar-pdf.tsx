import { createFileRoute } from "@tanstack/react-router";
import { PDFSignatureEditor } from "@/components/pdf/PDFSignatureEditor";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/assinar-pdf")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      fileUrl: (search.fileUrl as string) || "",
      fileName: (search.fileName as string) || "documento.pdf",
    };
  },
  component: AssinarPdfPage,
});

function AssinarPdfPage() {
  const { fileUrl, fileName } = Route.useSearch();

  if (!fileUrl) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold">Nenhum PDF selecionado</h1>
        <p className="text-muted-foreground mt-2">
          Selecione um documento para iniciar o processo de assinatura.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-80px)] -m-6">
      <PDFSignatureEditor fileUrl={fileUrl} fileName={fileName} />
    </div>
  );
}
