import { useMemo } from "react";
import DOMPurify from "dompurify";

interface SafeHtmlProps {
  html: string | null | undefined;
  className?: string;
}

/**
 * Ponto único de renderização de HTML vindo do banco (Mural de Avisos).
 * Nenhum componente deve usar `dangerouslySetInnerHTML` diretamente.
 */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  const sanitized = useMemo(() => {
    if (!html) return "";
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "style"],
    });
  }, [html]);

  if (!sanitized) return null;

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
