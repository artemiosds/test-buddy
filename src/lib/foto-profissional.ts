import { useEffect, useState } from "react";
import { obterUrlVisualizacao } from "@/lib/storage-universal";

/**
 * Foto do profissional.
 *
 * O arquivo fica no bucket PRIVADO `avatars`; a coluna `foto_url` guarda
 * apenas o caminho no Storage (ex.: `profissionais/<id>-<ts>.jpg`).
 * A exibição usa URL assinada de curta duração.
 *
 * Retrocompatível: valores antigos em formato `http(s)://…` continuam sendo
 * usados diretamente.
 */
export const FOTO_BUCKET = "avatars";
export const FOTO_TAMANHO_MAX = 5 * 1024 * 1024;
export const FOTO_MIMES_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

const EXT_POR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isUrlExterna(valor: string | null | undefined): boolean {
  return !!valor && /^https?:\/\//i.test(valor);
}

export function validarFoto(file: File): { ok: true; mime: string } | { ok: false; erro: string } {
  const mime = (file.type || "").toLowerCase();
  if (!(FOTO_MIMES_ACEITOS as readonly string[]).includes(mime)) {
    return { ok: false, erro: "Formato não aceito. Envie JPG, PNG ou WEBP." };
  }
  if (file.size <= 0) return { ok: false, erro: "Arquivo vazio." };
  if (file.size > FOTO_TAMANHO_MAX) {
    return { ok: false, erro: "Imagem muito grande (máximo 5MB)." };
  }
  return { ok: true, mime };
}

export function montarCaminhoFoto(profissionalId: string | null | undefined, mime: string): string {
  const ext = EXT_POR_MIME[mime] ?? "jpg";
  const owner = profissionalId || `novo-${crypto.randomUUID()}`;
  return `profissionais/${owner}-${Date.now()}.${ext}`;
}

/**
 * Gera (e renova) a URL assinada da foto a partir do caminho salvo.
 * Retrocompatível: caminhos antigos do bucket `avatars` continuam funcionando;
 * novos uploads gravados no Cloudflare R2 (`r2:...`) resolvem por URL assinada.
 */
export function useFotoAssinada(valor: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const alvo = (valor ?? "").trim();
    if (!alvo) {
      setUrl(null);
      return;
    }
    if (isUrlExterna(alvo)) {
      setUrl(alvo);
      return;
    }
    void (async () => {
      const resolvida = await obterUrlVisualizacao(alvo, {
        bucket: FOTO_BUCKET,
        expiraEm: 3600,
      });
      if (ativo) setUrl(resolvida);
    })();
    return () => {
      ativo = false;
    };
  }, [valor]);

  return url;
}
