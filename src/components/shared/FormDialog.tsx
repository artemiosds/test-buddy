import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type FormDialogSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<FormDialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitDisabled?: boolean;
  loading?: boolean;
  size?: FormDialogSize;
  footer?: ReactNode;
  contentClassName?: string;
};

/**
 * Envoltório padrão para diálogos de criação/edição. Encapsula o cabeçalho,
 * corpo e rodapé com ações primária/secundária, mantendo aparência idêntica
 * ao `Dialog` base.
 *
 * - Passe `footer` quando precisar de ações totalmente customizadas.
 * - Para diálogos com fluxo multi-step / tabs / lógica condicional de
 *   fechamento, continue usando `Dialog` diretamente.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Salvar",
  cancelLabel = "Cancelar",
  submitDisabled,
  loading,
  size = "md",
  footer,
  contentClassName,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(SIZE_CLASS[size], contentClassName)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">{children}</div>
        <DialogFooter>
          {footer ?? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                {cancelLabel}
              </Button>
              {onSubmit && (
                <Button onClick={onSubmit} disabled={submitDisabled || loading}>
                  {submitLabel}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FormDialog;