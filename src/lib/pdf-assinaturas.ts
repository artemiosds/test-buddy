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
import { getSignatureSignedUrl } from "@/lib/assinatura-storage";

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
  metadata: any;
};

/** Dimensões de referência do editor visual (A4 retrato em px) */
const REF_W = 400;
const REF_H = 560;

/**
 * Rótulo oficial do cargo por perfil, usado quando a assinatura cadastrada
 * não informa `titular_cargo`.
 */
const CARGO_POR_PERFIL: Record<string, string> = {
  MASTER: "ADMINISTRADOR(A) MASTER",
  GESTOR: "DIRETOR(A) ADMINISTRATIVO(A)",
  DIRETOR_UNIDADE: "DIRETOR(A) DA UNIDADE",
  SECRETARIO: "SECRETÁRIO(A) MUNICIPAL DE SAÚDE",
};

export function cargoDoPerfil(perfilCodigo: string | null): string | null {
  if (!perfilCodigo) return null;
  return CARGO_POR_PERFIL[perfilCodigo] ?? perfilCodigo.replace(/_/g, " ");
}


function fmtImagem(dataUri: string): "PNG" | "JPEG" | "WEBP" {
  const head = dataUri.slice(0, 40).toLowerCase();
  if (head.includes("image/jpeg") || head.includes("image/jpg")) return "JPEG";
  if (head.includes("image/webp")) return "WEBP";
  return "PNG";
}

/**
 * Desenha a imagem do carimbo/assinatura dentro da caixa (x,y,boxW,boxH)
 * preservando a proporção original e centralizando — evita a imagem "achatada".
 */
export function desenharImagemProporcional(
  doc: jsPDF,
  dataUri: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): void {
  try {
    let ratio = boxW / boxH;
    try {
      const props: any = (doc as any).getImageProperties(dataUri);
      if (props?.width && props?.height) ratio = props.width / props.height;
    } catch {
      /* usa a proporção da caixa */
    }
    let w = boxW;
    let h = w / ratio;
    if (h > boxH) {
      h = boxH;
      w = h * ratio;
    }
    const ox = x + (boxW - w) / 2;
    const oy = y + (boxH - h);
    doc.addImage(dataUri, fmtImagem(dataUri), ox, oy, w, h, undefined, "FAST");
  } catch {
    /* imagem inválida — ignora */
  }
}


/**
 * Converte qualquer imagem (Data URL) para PNG com fundo branco se houver transparência.
 * Isso evita o "fundo preto" em imagens com canal alpha no jsPDF.
 */
export async function removerFundoTransparente(dataUri: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUri);
        return;
      }
      // Fundo branco
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Desenha a imagem por cima
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUri);
    img.src = dataUri;
  });
}

async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUri = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    return await removerFundoTransparente(dataUri);
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
  opts: { secretariaId?: string | null; unidadeId?: string | null; frequenciaId?: string | null } = {},
): Promise<AssinaturaResolvida[]> {
  // Se for uma frequência com snapshot, buscamos os snapshots primeiro
  if (opts.frequenciaId && (tipo === "folha_efetivos" || tipo === "folha_contratados" || tipo === "frequencia")) {
    const { data: snapshots } = await supabase
      .from("frequencia_assinaturas_snapshot")
      .select("*")
      .eq("frequencia_id", opts.frequenciaId);

    if (snapshots && snapshots.length > 0) {
      return Promise.all(snapshots.map(async (s) => {
        let imageData: string | null = null;
        if (s.storage_path) {
          const signedUrl = await getSignatureSignedUrl(s.storage_path, null, 300);
          if (signedUrl) {
            imageData = await urlToDataUrl(signedUrl);
          }
        }

        // Mapeia para o perfil correspondente à ação
        const perfilCodigo = s.acao === "enviar" ? "DIRETOR_UNIDADE" : "GESTOR";

        return {
          regra_id: `snapshot-${s.id}`,
          perfil_codigo: perfilCodigo,
          tipo_assinatura: "assinatura",
          ordem: s.acao === "enviar" ? 1 : 2,
          obrigatoria: true,
          titular_nome: s.titular_nome,
          titular_cargo: s.titular_cargo,
          storage_path: s.storage_path,
          escopo: "global",
          imageData,
          assinatura_id: s.assinatura_id,
          posicao_x: s.posicao_x,
          posicao_y: s.posicao_y,
          tamanho_percentual: s.tamanho_percentual || 80,
          alinhamento: (s.alinhamento as any) || "centro",
          mostrar_nome: true,
          mostrar_cargo: true,
          metadata: s.metadata,
        } as AssinaturaResolvida;
      }));
    }
  }

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

  // Busca campos de posicionamento e metadados diretamente da tabela (não estão no RPC)
  const assinIds = rows.map((r) => r.assinatura_id).filter(Boolean) as string[];
  const extraMap = new Map<
    string,
    {
      posicao_x: number | null;
      posicao_y: number | null;
      tamanho_percentual: number | null;
      alinhamento: string | null;
      mostrar_nome: boolean | null;
      mostrar_cargo: boolean | null;
      metadata: any;
    }
  >();
  if (assinIds.length > 0) {
    const { data: posData } = await supabase
      .from("assinaturas_institucionais")
      .select(
        "id, posicao_x, posicao_y, tamanho_percentual, alinhamento, mostrar_nome, mostrar_cargo, metadata",
      )
      .in("id", assinIds);
    for (const p of (posData ?? []) as Array<{ id: string } & Record<string, unknown>>) {
      extraMap.set(p.id, {
        posicao_x: (p.posicao_x as number | null) ?? null,
        posicao_y: (p.posicao_y as number | null) ?? null,
        tamanho_percentual: (p.tamanho_percentual as number | null) ?? null,
        alinhamento: (p.alinhamento as string | null) ?? null,
        mostrar_nome: (p.mostrar_nome as boolean | null) ?? null,
        mostrar_cargo: (p.mostrar_cargo as boolean | null) ?? null,
        metadata: p.metadata,
      });
    }
  }

  // Contexto do usuário logado — permite preencher automaticamente nome/cargo
  // da assinatura cujo perfil corresponde a quem está emitindo o documento.
  let meuPerfil: string | null = null;
  let meuNome: string | null = null;
  let minhaMatricula: string | null = null;
  let meuCpf: string | null = null;
  try {
    const { data: ctx } = await supabase.rpc("get_my_user_context");
    const me = ctx as {
      perfil_codigo?: string | null;
      nome_completo?: string | null;
      matricula?: string | null;
      cpf?: string | null;
    } | null;
    meuPerfil = me?.perfil_codigo ?? null;
    meuNome = me?.nome_completo ?? null;
    minhaMatricula = me?.matricula ?? null;
    meuCpf = me?.cpf ?? null;
  } catch {
    /* sem contexto — segue com os dados cadastrados */
  }

  const resolvidas = await Promise.all(
    rows.map(async (r) => {
      let imageData: string | null = null;
      if (r.storage_path) {
        const signedUrl = await getSignatureSignedUrl(r.storage_path, null, 300);
        if (signedUrl) {
          // Na Vercel, URLs assinadas do Supabase podem ter restrições de CORS ou rede
          // Converter para DataURL garante que o jsPDF consiga ler a imagem
          imageData = await urlToDataUrl(signedUrl);
        }
      }
      const p = r.assinatura_id ? extraMap.get(r.assinatura_id) : undefined;
      const alin = (p?.alinhamento as "esquerda" | "centro" | "direita" | null) ?? "direita";
      const souEu = !!meuPerfil && r.perfil_codigo === meuPerfil;
      
      // Metadados dinâmicos para a assinatura "sou eu" se não houver metadados salvos
      const dynamicMetadata = p?.metadata || (souEu ? {
        matricula: minhaMatricula,
        cpf: meuCpf,
        cpf_mascarado: meuCpf ? `${meuCpf.slice(0, 3)}.***.***-${meuCpf.slice(-2)}` : null
      } : null);

      return {
        regra_id: r.regra_id,
        perfil_codigo: r.perfil_codigo,
        tipo_assinatura: r.tipo_assinatura,
        ordem: r.ordem,
        obrigatoria: r.obrigatoria,
        titular_nome: r.titular_nome ?? (souEu ? meuNome : null),
        titular_cargo: r.titular_cargo ?? cargoDoPerfil(r.perfil_codigo),
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
        metadata: dynamicMetadata,
      } as AssinaturaResolvida;
    }),
  );

  return resolvidas.sort((a, b) => a.ordem - b.ordem);
}


/**
 * Renderiza o rodapé institucional dinâmico com quadros padronizados.
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
  const blockH = opts.reservaAltura ?? 28; // Reduzido para caber melhor na grade de 2 colunas
  const usableW = pageWidth - marginX * 2;
  const colWidthLeft = (usableW / 2); // Ocupa apenas a coluna da esquerda

  let y = opts.startY ?? pageHeight - 32;

  // Se não couber, adiciona nova página
  if (y + blockH > pageHeight - 10) {
    doc.addPage();
    y = 24;
  }

  const perRow = Math.min(assin.length, 2); // No máximo 2 assinaturas lado a lado na coluna da esquerda
  const colW = colWidthLeft / perRow;

  for (let i = 0; i < assin.length; i++) {
    const a = assin[i];
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    
    const factor = (a.tamanho_percentual ?? 80) / 100;
    const boxW = Math.min(colW - 4, 75 * factor);
    const boxH = 22 * factor;
    
    const cx = marginX + col * colW + colW / 2;
    const cy = y + row * (blockH + 4);

    // Quadro padronizado com borda suave
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.05);
    doc.roundedRect(cx - colW / 2 + 1, cy - 2, colW - 2, blockH + 2, 0.5, 0.5, "S");

    // Imagem da assinatura (tratada com fundo branco)
    if (a.imageData) {
      desenharImagemProporcional(doc, a.imageData, cx - boxW / 2, cy, boxW, boxH);
    }

    const lineY = cy + boxH + 2;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(cx - boxW / 2, lineY, cx + boxW / 2, lineY);

    // Dados dinâmicos do titular
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const nome = a.titular_nome ?? (a.obrigatoria ? "___________________" : "NÃO IDENTIFICADO");
    doc.text(nome.toUpperCase(), cx, lineY + 3, { align: "center", maxWidth: colW - 4 });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    
    const cargo = (a.titular_cargo ?? cargoDoPerfil(a.perfil_codigo) ?? "CARGO NÃO INFORMADO").toUpperCase();
    doc.text(cargo, cx, lineY + 6, { align: "center", maxWidth: colW - 4 });

    const metadata = a.metadata;
    const ato = metadata?.ato_ou_decreto || metadata?.decreto || "";
    if (ato) {
      doc.setFontSize(5.5);
      doc.text(String(ato).toUpperCase(), cx, lineY + 8.5, { align: "center", maxWidth: colW - 4 });
    }

    if (a.escopo === "ausente" && a.obrigatoria) {
      doc.setTextColor(200, 60, 60);
      doc.setFontSize(7);
      doc.text("(ASSINATURA PENDENTE)", cx, cy + blockH / 2, { align: "center" });
    }
  }

  const rowsN = Math.ceil(assin.length / perRow);
  return y + rowsN * (blockH + 8);
}

/**
 * Lista as regras obrigatórias que não possuem assinatura cadastrada.
 */
export function assinaturasFaltantes(assinaturas: AssinaturaResolvida[]): string[] {
  return assinaturas
    .filter((a) => a.obrigatoria && a.escopo === "ausente")
    .map((a) => a.perfil_codigo ?? a.tipo_assinatura);
}
