import { toast } from "sonner";

const CHUNK_DESATUALIZADO_RE =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

type ChunkRecoveryOptions = {
  beforeReload?: () => boolean | Promise<boolean>;
};

/**
 * Trata página/chunk pertencente a deploy anterior.
 * Não recarrega automaticamente para não perder edição em andamento.
 */
export function notificarModuloDesatualizado(
  error: unknown,
  options: ChunkRecoveryOptions = {},
): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!CHUNK_DESATUALIZADO_RE.test(message)) return false;

  toast.error("Nova versão disponível — atualize para continuar.", {
    id: "chunk-desatualizado",
    duration: Infinity,
    description:
      "Se houver alterações na folha, elas serão confirmadas antes da atualização.",
    action: {
      label: "Atualizar agora",
      onClick: async () => {
        try {
          if (options.beforeReload) {
            const ok = await options.beforeReload();
            if (!ok) {
              toast.error(
                "Não foi possível confirmar todas as alterações. A página não será atualizada.",
              );
              return;
            }
          }
          window.location.reload();
        } catch {
          toast.error(
            "Não foi possível confirmar todas as alterações. A página não será atualizada.",
          );
        }
      },
    },
  });
  return true;
}

/** Registra o service worker e avisa quando há nova versão disponível. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  void navigator.serviceWorker
    .register("/sw.js", { updateViaCache: "none" })
    .then((registration) => {
      // Força verificação da versão atual do sw.js sem reutilizar cópia HTTP antiga.
      void registration.update();

      const notify = (worker: ServiceWorker) => {
        toast.info("Nova versão do sistema disponível.", {
          id: "pwa-update",
          duration: Infinity,
          description:
            "Se estiver editando uma folha, salve as alterações antes de atualizar.",
          action: {
            label: "Atualizar Agora",
            onClick: () => {
              worker.postMessage("SKIP_WAITING");
              window.location.reload();
            },
          },
        });
      };

      if (registration.waiting) notify(registration.waiting);

      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            notify(installing);
          }
        });
      });
    })
    .catch(() => {
      /* registro do SW é best-effort */
    });
}
