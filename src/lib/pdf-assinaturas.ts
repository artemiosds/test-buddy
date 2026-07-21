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
  /** posicionamento personalizado (referência 400x560 px A4 retrato) */
  posicao_x: number | null;
  posicao_y: number | null;
  tamanho_percentual: number;
  alinhamento: "esquerda" | "centro" | "direita";
  mostrar_nome: boolean;
  mostrar_cargo: boolean;
  assinatura_id: string | null;
};

/** Dimensões de referência do editor visual (A4 retrato em px) */
const REF_W = 400;
const REF_H = 560;

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

  // Busca campos de posicionamento diretamente da tabela (não estão no RPC)
  const assinIds = rows.map((r) => r.assinatura_id).filter(Boolean) as string[];
  const posMap = new Map<
    string,
    {
      posicao_x: number | null;
      posicao_y: number | null;
      tamanho_percentual: number | null;
      alinhamento: string | null;
      mostrar_nome: boolean | null;
      mostrar_cargo: boolean | null;
    }
  >();
  if (assinIds.length > 0) {
    const { data: posData } = await supabase
      .from("assinaturas_institucionais")
      .select(
        "id, posicao_x, posicao_y, tamanho_percentual, alinhamento, mostrar_nome, mostrar_cargo",
      )
      .in("id", assinIds);
    for (const p of (posData ?? []) as Array<{ id: string } & Record<string, unknown>>) {
      posMap.set(p.id, {
        posicao_x: (p.posicao_x as number | null) ?? null,
        posicao_y: (p.posicao_y as number | null) ?? null,
        tamanho_percentual: (p.tamanho_percentual as number | null) ?? null,
        alinhamento: (p.alinhamento as string | null) ?? null,
        mostrar_nome: (p.mostrar_nome as boolean | null) ?? null,
        mostrar_cargo: (p.mostrar_cargo as boolean | null) ?? null,
      });
    }
  }

  const resolvidas = await Promise.all(
    rows.map(async (r) => {
      let imageData: string | null = null;
      if (r.storage_path) {
        const { data: signed } = await supabase.storage
          .from("assinaturas")
          .createSignedUrl(r.storage_path, 300);
        if (signed?.signedUrl) imageData = await urlToDataUrl(signed.signedUrl);
      }
      const p = r.assinatura_id ? posMap.get(r.assinatura_id) : undefined;
      const alin = (p?.alinhamento as "esquerda" | "centro" | "direita" | null) ?? "direita";
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
        assinatura_id: r.assinatura_id,
        posicao_x: p?.posicao_x ?? null,
        posicao_y: p?.posicao_y ?? null,
        tamanho_percentual: p?.tamanho_percentual ?? 80,
        alinhamento: alin,
        mostrar_nome: p?.mostrar_nome ?? true,
        mostrar_cargo: p?.mostrar_cargo ?? true,
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

  // Separa assinaturas com posicionamento custom (posicao_x/y definidos)
  const custom = assin.filter((a) => a.posicao_x !== null && a.posicao_y !== null);
  const fluxo = assin.filter((a) => a.posicao_x === null || a.posicao_y === null);

  // ---- Assinaturas com posição custom (coordenadas absolutas na página) ----
  const baseImgW = 55; // largura base em mm (100%)
  const baseImgH = 16;
  for (const a of custom) {
    const scaleX = pageWidth / REF_W;
    const scaleY = pageHeight / REF_H;
    const factor = (a.tamanho_percentual ?? 80) / 100;
    const imgW = baseImgW * factor;
    const imgH = baseImgH * factor;
    const px = (a.posicao_x ?? 0) * scaleX;
    const py = (a.posicao_y ?? 0) * scaleY;
    if (a.imageData) {
      try {
        doc.addImage(a.imageData, "PNG", px, py, imgW, imgH);
      } catch {
        /* ignore */
      }
    }
    const lineY = py + imgH + 1.5;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(px, lineY, px + imgW, lineY);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    if (a.mostrar_nome && a.titular_nome) {
      doc.text(a.titular_nome, px + imgW / 2, lineY + 3.5, {
        align: "center",
        maxWidth: imgW,
      });
    }
    if (a.mostrar_cargo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      const cargo =
        a.titular_cargo ??
        (a.perfil_codigo ? a.perfil_codigo.replace(/_/g, " ") : "");
      if (cargo) {
        doc.text(cargo, px + imgW / 2, lineY + 6.8, {
          align: "center",
          maxWidth: imgW,
        });
      }
    }
  }

  if (fluxo.length === 0) return opts.startY ?? 0;

  let y = opts.startY ?? pageHeight - blockH - 22;

  if (y + blockH > pageHeight - 18) {
    doc.addPage();
    y = 24;
  }

  const perRow = Math.min(fluxo.length, 3);
  const usableW = pageWidth - marginX * 2;
  const colW = usableW / perRow;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);

  for (let i = 0; i < fluxo.length; i++) {
    const a = fluxo[i];
    const factor = (a.tamanho_percentual ?? 80) / 100;
    const imgH = 16 * factor;
    const imgW = Math.min(colW - 8, 55 * factor);
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    // alinhamento dentro da coluna
    let cx = marginX + col * colW + colW / 2;
    if (a.alinhamento === "esquerda") cx = marginX + col * colW + imgW / 2 + 4;
    else if (a.alinhamento === "direita") cx = marginX + (col + 1) * colW - imgW / 2 - 4;
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

    if (a.mostrar_nome) {
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const nome = a.titular_nome ?? (a.obrigatoria ? "___________________" : "-");
      doc.text(nome, cx, lineY + 4, { align: "center", maxWidth: colW - 4 });
    }

    if (a.mostrar_cargo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      const cargo =
        a.titular_cargo ??
        (a.perfil_codigo ? a.perfil_codigo.replace(/_/g, " ") : "");
      if (cargo) {
        doc.text(cargo, cx, lineY + 8, { align: "center", maxWidth: colW - 4 });
      }
    }

    if (a.escopo === "ausente" && a.obrigatoria) {
      doc.setTextColor(200, 60, 60);
      doc.setFontSize(7);
      doc.text("(assinatura pendente)", cx, lineY + 12, { align: "center" });
    }
  }

  const rowsN = Math.ceil(fluxo.length / perRow);
  return y + rowsN * (blockH + 4);
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
