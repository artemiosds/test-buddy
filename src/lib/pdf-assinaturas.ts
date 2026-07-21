/**
 * Resolução hierárquica e renderização de assinaturas em PDFs.
 *
 * Usa a função SQL `public.get_assinaturas_documento(_tipo_documento, _secretaria_id?, _unidade_id?)`
 * que retorna a assinatura mais específica por regra
 * (Perfil + Unidade → Perfil + Secretaria → Perfil Global → Institucional).
 *
 * Tipos oficiais: frequencia | folha_efetivos | folha_contratados | piso | relatorio
 */
import type jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

export type TipoDocumento =
  | "frequencia"
  | "folha_efetivos"
  | "folha_contratados"
  | "piso"
  | "relatorio";

export type AssinaturaResolvida = {
  regra_id: string;
  perfil_codigo: string | null;
  tipo_assinatura: "assinatura" | "carimbo" | "logo";
  ordem: number;
  obrigatoria: boolean;
  titular_nome: string | null;
  titular_cargo: string | null;
  storage_path: string | null;
  escopo: "unidade" | "secretaria" | "global" | "ausente";
  /** data URL da imagem já carregada (null quando ausente) */
  imageData: string | null;
};

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Resolve todas as regras aplicáveis (assinaturas + logos) para o documento,
 * já carregando as imagens em data URL a partir do bucket privado `assinaturas`.
 */
export async function resolverAssinaturasDocumento(
  tipo: TipoDocumento,
  opts: { secretariaId?: string | null; unidadeId?: string | null } = {},
): Promise<AssinaturaResolvida[]> {
  const { data, error } = await supabase.rpc("get_assinaturas_documento", {
    _tipo_documento: tipo,
    _secretaria_id: opts.secretariaId ?? undefined,
    _unidade_id: opts.unidadeId ?? undefined,
  });
  if (error || !data) return [];

  const rows = data as unknown as Array<{
    regra_id: string;
    perfil_codigo: string | null;
    tipo_assinatura: "assinatura" | "carimbo" | "logo";
    ordem: number;
    obrigatoria: boolean;
    assinatura_id: string | null;
    titular_nome: string | null;
    titular_cargo: string | null;
    storage_path: string | null;
    escopo: "unidade" | "secretaria" | "global" | "ausente";
  }>;

  const resolvidas = await Promise.all(
    rows.map(async (r) => {
      let imageData: string | null = null;
      if (r.storage_path) {
        const { data: signed } = await supabase.storage
          .from("assinaturas")
          .createSignedUrl(r.storage_path, 300);
        if (signed?.signedUrl) imageData = await urlToDataUrl(signed.signedUrl);
      }
      return {
        regra_id: r.regra_id,
        perfil_codigo: r.perfil_codigo,
        tipo_assinatura: r.tipo_assinatura,
        ordem: r.ordem,
        obrigatoria: r.obrigatoria,
        titular_nome: r.titular_nome,
        titular_cargo: r.titular_cargo,
        storage_path: r.storage_path,
        escopo: r.escopo,
        imageData,
      } as AssinaturaResolvida;
    }),
  );

  return resolvidas.sort((a, b) => a.ordem - b.ordem);
}

/**
 * Renderiza o bloco de assinaturas do documento no PDF.
 *
 * Distribui as assinaturas (tipo `assinatura` ou `carimbo`) em até 3 colunas
 * por linha, com a imagem (quando existir) e as linhas de titular/cargo
 * abaixo. Retorna o Y final do bloco.
 *
 * Se `startY` não couber, adiciona uma nova página.
 */
export function drawAssinaturasBlock(
  doc: jsPDF,
  assinaturas: AssinaturaResolvida[],
  opts: {
    startY?: number;
    marginX?: number;
    reservaAltura?: number;
  } = {},
): number {
  const assin = assinaturas.filter(
    (a) => a.tipo_assinatura === "assinatura" || a.tipo_assinatura === "carimbo",
  );
  if (assin.length === 0) return opts.startY ?? 0;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = opts.marginX ?? 14;
  const blockH = opts.reservaAltura ?? 34;
  let y = opts.startY ?? pageHeight - blockH - 22;

  if (y + blockH > pageHeight - 18) {
    doc.addPage();
    y = 24;
  }

  const perRow = Math.min(assin.length, 3);
  const usableW = pageWidth - marginX * 2;
  const colW = usableW / perRow;
  const imgH = 16;
  const imgW = Math.min(colW - 8, 55);

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  for (let i = 0; i < assin.length; i++) {
    const a = assin[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const cx = marginX + col * colW + colW / 2;
    const cy = y + row * (blockH + 4);

    if (a.imageData) {
      try {
        doc.addImage(a.imageData, "PNG", cx - imgW / 2, cy, imgW, imgH);
      } catch {
        /* ignore */
      }
    }

    const lineY = cy + imgH + 2;
    doc.line(cx - colW / 2 + 6, lineY, cx + colW / 2 - 6, lineY);

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const nome = a.titular_nome ?? (a.obrigatoria ? "___________________" : "-");
    doc.text(nome, cx, lineY + 4, { align: "center", maxWidth: colW - 4 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const cargo =
      a.titular_cargo ??
      (a.perfil_codigo ? a.perfil_codigo.replace(/_/g, " ") : "");
    if (cargo) {
      doc.text(cargo, cx, lineY + 8, { align: "center", maxWidth: colW - 4 });
    }

    if (a.escopo === "ausente" && a.obrigatoria) {
      doc.setTextColor(200, 60, 60);
      doc.setFontSize(7);
      doc.text("(assinatura pendente)", cx, lineY + 12, { align: "center" });
    }
  }

  const rows = Math.ceil(assin.length / perRow);
  return y + rows * (blockH + 4);
}

/**
 * Lista as regras obrigatórias que não possuem assinatura cadastrada.
 */
export function assinaturasFaltantes(
  assinaturas: AssinaturaResolvida[],
): string[] {
  return assinaturas
    .filter((a) => a.obrigatoria && a.escopo === "ausente")
    .map((a) => a.perfil_codigo ?? a.tipo_assinatura);
}
