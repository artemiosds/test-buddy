import { toast as sonnerToast, type ExternalToast } from "sonner";

/**
 * Wrapper opcional de `sonner` com durações padronizadas por tipo:
 *  - success: 3s   (feedback rápido de ação bem-sucedida)
 *  - info:    4s   (avisos neutros)
 *  - warning: 5s   (usuário precisa ler)
 *  - error:   6s   (usuário precisa entender o problema)
 *
 * O `<Toaster />` já aplica os tokens semânticos (success/warning/danger/info)
 * via classes. Este helper apenas centraliza as durações.
 *
 * Uso:
 *   import { toast } from "@/lib/toast";
 *   toast.success("Salvo");
 *
 * Chamadas existentes de `import { toast } from "sonner"` continuam válidas
 * e usam a duration global do Toaster (4s). Migração é opcional.
 */
export const toast = {
  success: (message: string, opts?: ExternalToast) =>
    sonnerToast.success(message, { duration: 3000, ...opts }),
  info: (message: string, opts?: ExternalToast) =>
    sonnerToast.info(message, { duration: 4000, ...opts }),
  warning: (message: string, opts?: ExternalToast) =>
    sonnerToast.warning(message, { duration: 5000, ...opts }),
  error: (message: string, opts?: ExternalToast) =>
    sonnerToast.error(message, { duration: 6000, ...opts }),
  message: sonnerToast,
};
