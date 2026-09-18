import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Search, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Porta de entrada do QR Code impresso nos PDFs.
 * A validação em si acontece em /validar/{codigo} — página única e oficial.
 */
export const Route = createFileRoute("/api/public/validar-documento")({
  component: ValidarDocumentoPage,
});

function ValidarDocumentoPage() {
  const search = useSearch({ strict: false }) as { codigo?: string };
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState(search.codigo ?? "");

  useEffect(() => {
    const c = (search.codigo ?? "").trim();
    if (c) void navigate({ to: "/validar/$id", params: { id: c }, replace: true });
  }, [search.codigo, navigate]);

  return (
    <div className="min-h-dvh bg-muted flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card rounded-2xl shadow-lg border overflow-hidden">
        <div className="bg-primary text-primary-foreground p-8 text-center space-y-3">
          <ShieldCheck className="w-14 h-14 mx-auto" />
          <h1 className="text-2xl font-bold tracking-tight">Portal de Autenticidade Digital</h1>
          <p className="text-sm opacity-90">
            Verifique a validade de documentos emitidos pela Secretaria Municipal de Saúde de
            Oriximiná.
          </p>
        </div>

        <form
          className="p-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const c = codigo.trim();
            if (c) void navigate({ to: "/validar/$id", params: { id: c } });
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Código de autenticidade
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex.: HSM-2026-ABC12345"
                className="pl-10 h-12 font-mono"
              />
            </div>
            <Button type="submit" className="h-12 px-6 gap-2" disabled={!codigo.trim()}>
              <Search className="w-4 h-4" />
              Validar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            O código consta no rodapé do PDF, ao lado do QR Code.
          </p>
        </form>
      </div>
    </div>
  );
}
