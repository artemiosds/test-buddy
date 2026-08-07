/* Service Worker — cache de assets estáticos (leitura offline).
   Mutações nunca são cacheadas; requisições de API sempre vão à rede. */
const CACHE_NAME = "sms-oriximina-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Fallback offline para navegação de páginas (HTML)
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch (err) {
          // Se falhar a navegação (offline), tenta o cache ou retorna a página de fallback
          const cached = await caches.match(req);
          if (cached) return cached;
          
          return new Response(
            `<!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Offline | SMS Oriximiná</title>
              <style>
                body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
                .card { text-align: center; padding: 2rem; border-radius: 0.5rem; background: white; shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 400px; }
                h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
                p { color: #6b7280; font-size: 0.875rem; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Página Indisponível</h1>
                <p>Esta página não está disponível em cache offline. Conecte-se à internet para carregá-la pela primeira vez.</p>
                <button onclick="window.location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #0d9488; color: white; border: none; border-radius: 0.25rem; cursor: pointer;">Tentar novamente</button>
              </div>
            </body>
            </html>`,
            {
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }
      })()
    );
    return;
  }

  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  
  // Nunca cachear chamadas de dados/servidor (LGPD: sem PII em cache).
  if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;

  const isAsset = /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/.test(url.pathname);
  if (!isAsset) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    })(),
  );
});
