/**
 * Botão único de exportação em layout ABNT para as telas de
 * Relatórios Gerenciais. Recebe os dados já exibidos na tela — não altera
 * consultas, filtros ou qualquer fluxo do sistema.
 */
import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-permissions";
import { gerarRelatorioAbnt, type AbntRelatorio } from "@/lib/relatorio-abnt";

export function BotaoRelatorioAbnt<T>({
  relatorio,
  label = "PDF ABNT",
  size = "sm",
  variant = "default",
  disabled,
}: {
  relatorio: () =>
    | Omit<AbntRelatorio<T>, "emitidoPor">
    | Promise<Omit<AbntRelatorio<T>, "emitidoPor">>;
  label?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "secondary";
  disabled?: boolean;
}) {
  const [gerando, setGerando] = useState(false);
  const { data: me } = useCurrentUser();

  async function gerar() {
    setGerando(true);
    try {
      const cfg = await relatorio();

      if (!cfg.linhas.length && !cfg.kpis?.length) {
        toast.error("Nada para exportar com os filtros atuais.");
        return;
      }
      await gerarRelatorioAbnt({
        ...cfg,
        emitidoPor: {
          nome: me?.nome_completo ?? me?.email ?? "Gestão Saúde",
          identificador: me?.email ?? "—",
        },
      });
      toast.success("Relatório ABNT gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={() => void gerar()}
      disabled={disabled || gerando}
    >
      {gerando ? (
        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
      ) : (
        <FileText className="mr-1 h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
