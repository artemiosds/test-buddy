/**
 * Resolve URLs de assets Lovable (`/__l5e/assets-v1/...`) em qualquer hospedagem.
 *
 * Em previews/publicações Lovable, os assets são servidos no mesmo origin.
 * Em hospedagens self-hosted (Docker, Nginx, custom domain) o path `/__l5e/*`
 * não existe — por isso caímos automaticamente na URL pública estável do
 * projeto (`project--<id>.lovable.app`), que sempre serve os assets.
 */

// Preview URL do projeto (estável, independente de renome).
const PROJECT_ID = "6f0f0785-7c6d-47d2-ab2d-4277c8b8fcf4";
const FALLBACK_ORIGINS = [
  `https://project--${PROJECT_ID}.lovable.app`,
  `https://project--${PROJECT_ID}-dev.lovable.app`,
];

function candidates(url: string): string[] {
  if (/^https?:\/\//i.test(url)) return [url];
  const list: string[] = [];
  if (typeof window !== "undefined") list.push(url); // relativo ao origin atual
  for (const o of FALLBACK_ORIGINS) list.push(`${o}${url}`);
  return list;
}

async function tryFetch(url: string): Promise<Response | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (r.ok) return r;
  } catch {
    /* noop */
  }
  return null;
}

export async function fetchAssetArrayBuffer(url: string): Promise<ArrayBuffer | null> {
  for (const c of candidates(url)) {
    const r = await tryFetch(c);
    if (r) return await r.arrayBuffer();
  }
  return null;
}

export async function fetchAssetDataUrl(url: string): Promise<string | null> {
  for (const c of candidates(url)) {
    const r = await tryFetch(c);
    if (!r) continue;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  return null;
}
