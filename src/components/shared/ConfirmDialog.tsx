import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConfirmTone = "default" | "destructive";

export type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
};

type Props = ConfirmOptions & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
};

/**
 * Diálogo de confirmação padrão — sempre use este componente (ou `useConfirm`)
 * no lugar de `window.confirm` ou de `AlertDialog` inline.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "default",
  onConfirm,
  loading,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className={cn(
              tone === "destructive" &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- Imperativo: useConfirm() ----------

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ ...opts, open: true });
    });
  }, []);

  const handleChange = (open: boolean) => {
    if (!open) {
      resolverRef.current?.(false);
      resolverRef.current = null;
      setState((s) => (s ? { ...s, open: false } : s));
    }
  };

  const handleConfirm = () => {
    resolverRef.current?.(true);
    resolverRef.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  };

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <ConfirmDialog
          open={state.open}
          onOpenChange={handleChange}
          title={state.title}
          description={state.description}
          confirmLabel={state.confirmLabel}
          cancelLabel={state.cancelLabel}
          tone={state.tone}
          onConfirm={handleConfirm}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}