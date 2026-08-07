import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import { AlertCircle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    logger.error("route.error_boundary", { error });
    reportLovableError(error, { boundary: "route_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Ocorreu um erro ao carregar esta seção
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Não foi possível carregar os dados desta página. Isso pode ser um problema temporário de conexão ou um erro no servidor.
      </p>
      
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Tentar novamente
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.href = "/"}
          className="gap-2"
        >
          <Home className="h-4 w-4" />
          Ir para o início
        </Button>
      </div>
      
      {process.env.NODE_ENV === "development" && (
        <pre className="mt-8 max-w-full overflow-auto rounded bg-muted p-4 text-left text-xs text-muted-foreground">
          {error.message}
          {"\n"}
          {error.stack}
        </pre>
      )}
    </div>
  );
}
