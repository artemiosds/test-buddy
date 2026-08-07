import { toast } from "sonner";

/** Registra o service worker e avisa quando há nova versão disponível. */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  void navigator.serviceWorker
    .register("/sw.js")
    .then((registration) => {
      const notify = (worker: ServiceWorker) => {
        toast.info("Nova versão do sistema disponível.", {
          id: "pwa-update",
          duration: Infinity,
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
