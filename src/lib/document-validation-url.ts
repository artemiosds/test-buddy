const PREVIEW_HOST_RE = /(^localhost$|^127\.0\.0\.1$|-preview--|\.lovableproject(?:-dev)?\.com$|\.gpt-eng\.com$|\.gptengineer\.run$)/i;

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function isTemporaryOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return PREVIEW_HOST_RE.test(url.hostname);
  } catch {
    return true;
  }
}

export function getCanonicalPublicOrigin(): string | null {
  const configured = normalizeOrigin(import.meta.env.VITE_APP_URL ?? "");
  if (configured && !isTemporaryOrigin(configured)) return configured;

  if (typeof window === "undefined") return null;
  const current = normalizeOrigin(window.location.origin);
  return isTemporaryOrigin(current) ? null : current;
}

export function getDocumentValidationUrl(code: string): string {
  const origin = getCanonicalPublicOrigin();
  if (!origin) {
    throw new Error(
      "Defina o endereço público oficial do sistema antes de emitir um PDF com QR Code.",
    );
  }
  return `${origin}/api/public/validar-documento?codigo=${encodeURIComponent(code)}`;
}

export function tryGetDocumentValidationUrl(code: string): string | null {
  try {
    return getDocumentValidationUrl(code);
  } catch {
    return null;
  }
}