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
    const oy = y + (boxH - h) / 2;
    doc.addImage(dataUri, fmtImagem(dataUri), ox, oy, w, h, undefined, "FAST");
  } catch {

    /* imagem inválida — ignora */
  }
}


/**
 * Normaliza uma imagem de carimbo/assinatura (Data URL) para PNG.
 *
 * - modo "transparente" (padrão): preserva o canal alfa e transforma os pixels
 *   quase brancos do fundo digitalizado em transparentes, de modo que o carimbo
 *   se misture ao fundo da folha (linhas, tabelas, faixas) sem caixa branca.
 * - modo "branco": achata a imagem contra um fundo branco (comportamento legado,
 *   usado como fallback).
 */
export async function removerFundoTransparente(
  dataUri: string,
  modo: "transparente" | "branco" = "transparente",
  tolerancia = 238,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUri);
          return;
        }

        if (modo === "branco") {
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
          return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = imageData.data;
        for (let i = 0; i < px.length; i += 4) {
          const a = px[i + 3];
          if (a === 0) continue;
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          if (r >= tolerancia && g >= tolerancia && b >= tolerancia) {
            px[i + 3] = 0;
          } else {
            // Suaviza a borda: quanto mais claro o pixel, mais translúcido
            const luminancia = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
            if (luminancia > 0.82) px[i + 3] = Math.round(a * (1 - (luminancia - 0.82) / 0.18));
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        // Fallback seguro: nunca quebra a emissão do documento
        resolve(dataUri);
      }
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
  // Snapshots capturados no envio/aprovação da folha (quando existirem).
  // Eles NÃO substituem as demais regras: são mesclados com as regras
  // vigentes para que todos os signatários (Direção + Gestor/Secretaria)
  // apareçam no documento.
  let snapshotList: AssinaturaResolvida[] = [];
  if (opts.frequenciaId && (tipo === "folha_efetivos" || tipo === "folha_contratados" || tipo === "frequencia")) {
    const { data: snapshots } = await supabase
      .from("frequencia_assinaturas_snapshot")
      .select("*")
      .eq("frequencia_id", opts.frequenciaId);

    if (snapshots && snapshots.length > 0) {
      // Descobre o perfil real de cada assinatura usada no snapshot
      const snapIds = snapshots.map((s) => s.assinatura_id).filter(Boolean) as string[];
      const perfilPorAssinatura = new Map<string, string | null>();
      if (snapIds.length > 0) {
        const { data: assinRows } = await supabase
          .from("assinaturas_institucionais")
          .select("id, perfis:perfil_id(codigo)")
          .in("id", snapIds);
        for (const r of (assinRows ?? []) as Array<{ id: string; perfis: { codigo: string } | null }>) {
          perfilPorAssinatura.set(r.id, r.perfis?.codigo ?? null);
        }
      }

      snapshotList = await Promise.all(
        snapshots.map(async (s) => {
          let imageData: string | null = null;
          if (s.storage_path) {
            const signedUrl = await getSignatureSignedUrl(s.storage_path, null, 300);
            if (signedUrl) {
              imageData = await urlToDataUrl(signedUrl);
            }
          }

          const perfilCodigo =
            (s.assinatura_id ? perfilPorAssinatura.get(s.assinatura_id) : null) ??
            (s.acao === "enviar" ? "DIRETOR_UNIDADE" : "GESTOR");

          return {
            regra_id: `snapshot-${s.id}`,
            perfil_codigo: perfilCodigo,
            tipo_assinatura: "assinatura",
            ordem: perfilCodigo === "DIRETOR_UNIDADE" ? 1 : 2,
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
        }),
      );
    }
  }

  const { data, error } = await supabase.rpc("get_assinaturas_documento", {

    _tipo_documento: tipo,
    _secretaria_id: opts.secretariaId ?? undefined,
    _unidade_id: opts.unidadeId ?? undefined,
  });
  if (error || !data) return snapshotList;



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

  // Mescla snapshots (prioritários) com as regras vigentes dos outros perfis,
  // evitando duplicar o mesmo perfil no rodapé.
  const perfisSnapshot = new Set(snapshotList.map((s) => s.perfil_codigo).filter(Boolean) as string[]);
  const complementares = resolvidas.filter(
    (r) => !r.perfil_codigo || !perfisSnapshot.has(r.perfil_codigo),
  );
  const finais = [...snapshotList, ...complementares];

  // Remove duplicidades por perfil (mantém a primeira, já ordenada por prioridade)
  const vistos = new Set<string>();
  const unicas = finais.filter((a) => {
    const key = a.perfil_codigo ?? a.regra_id;
    if (vistos.has(key)) return false;
    vistos.add(key);
    return true;
  });

  return unicas.sort((a, b) => a.ordem - b.ordem);
}


/**
 * Renderiza o bloco de assinaturas do documento no PDF.
 * Adiciona também o selo de autenticidade (QR Code/Hash) no rodapé.
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

  // O selo agora é desenhado via drawSignatureStamp no pipeline, 
  // mas mantemos este fallback se o ID estiver disponível e for um fluxo legado
  const docId = (opts as any)?.documentoId || (assinaturas[0] as any)?.documento_id;
  if (docId) {
    const stampY = pageHeight - 12;
    doc.setFontSize(6);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    const validationUrl = `${window.location.origin}/validar/${docId}`;
    doc.text(`Para verificar a autenticidade deste documento, acesse: ${validationUrl}`, marginX, stampY);
    doc.text(`Código de Autenticidade (Hash): ${docId}`, marginX, stampY + 3);
  }



  // Separa assinaturas com posicionamento custom (posicao_x/y definidos)
  const custom = assin.filter((a) => a.posicao_x !== null && a.posicao_y !== null);
  const fluxo = assin.filter((a) => a.posicao_x === null || a.posicao_y === null);

  // ---- Assinaturas com posição custom (coordenadas absolutas na página) ----
  const baseImgW = 75; // largura base em mm (100%) - Aumentado de 55 para 75
  const baseImgH = 30; // altura base em mm - Aumentado de 22 para 30
  for (const a of custom) {
    const scaleX = pageWidth / REF_W;
    const scaleY = pageHeight / REF_H;
    const factor = (a.tamanho_percentual ?? 80) / 100;
    const imgW = baseImgW * factor;
    const imgH = baseImgH * factor;
    const px = (a.posicao_x ?? 0) * scaleX;
    const py = (a.posicao_y ?? 0) * scaleY;
    if (a.imageData) {
      desenharImagemProporcional(doc, a.imageData, px, py, imgW, imgH);
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
    const metadata = (a as any).metadata;
    if (a.mostrar_cargo) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 90);
      
      const cargo = a.titular_cargo ?? cargoDoPerfil(a.perfil_codigo) ?? "";
      const matricula = metadata?.matricula ? `Matrícula: ${metadata.matricula}` : "";
      const cpf = metadata?.cpf_mascarado || (metadata?.cpf ? `${metadata.cpf.slice(0, 3)}.***.***-${metadata.cpf.slice(-2)}` : "");
      const cpfLabel = cpf ? `CPF: ${cpf}` : "";
      
      let extraLines = [cargo, matricula, cpfLabel].filter(Boolean);
      extraLines.forEach((line, idx) => {
        doc.text(line, px + imgW / 2, lineY + 6.8 + idx * 3, {
          align: "center",
          maxWidth: imgW,
        });
      });
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
    const imgH = 30 * factor;
    const imgW = Math.min(colW - 8, 75 * factor);
    const row = Math.floor(i / perRow);
    const col = i % perRow;

    // Alinhamento inteligente:
    // Se houver 2 ou 3 assinaturas, a do Diretor (normalmente a 1ª ou 2ª)
    // deve ficar centralizada ou conforme a ordem.
    // O usuário solicitou: Diretor ao Meio, Secretaria à Direita.
    let cx = marginX + col * colW + colW / 2;
    
    // Se for o perfil de secretário ou a última de 3, joga pra direita
    if (a.perfil_codigo === "SECRETARIO" || (fluxo.length === 3 && i === 2)) {
      cx = pageWidth - marginX - imgW / 2 - 4;
    } 
    // Se for diretor de unidade e houver espaço para ser "meio"
    else if (a.perfil_codigo === "DIRETOR_UNIDADE" && fluxo.length >= 2) {
      if (fluxo.length === 2) {
        // Com 2, "meio" é relativo. Vamos centralizar o bloco.
        cx = pageWidth / 2;
      } else {
        // Com 3, o índice 1 é o meio exato
        cx = marginX + colW + colW / 2;
      }
    }
    const cy = y + row * (blockH + 4);

    if (a.imageData) {
      desenharImagemProporcional(doc, a.imageData, cx - imgW / 2, cy, imgW, imgH);
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
      
      const cargo = a.titular_cargo ?? cargoDoPerfil(a.perfil_codigo) ?? "";
      const metadata = a.metadata;
      const matricula = metadata?.matricula ? `Matrícula: ${metadata.matricula}` : "";
      const cpf = metadata?.cpf_mascarado || (metadata?.cpf ? `${metadata.cpf.slice(0, 3)}.***.***-${metadata.cpf.slice(-2)}` : "");
      const cpfLabel = cpf ? `CPF: ${cpf}` : "";
      
      const extraLines = [cargo, matricula, cpfLabel].filter(Boolean);
      extraLines.forEach((line, idx) => {
        doc.text(line, cx, lineY + 8 + idx * 3.5, { align: "center", maxWidth: colW - 4 });
      });
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
export function assinaturasFaltantes(assinaturas: AssinaturaResolvida[]): string[] {
  return assinaturas
    .filter((a) => a.obrigatoria && a.escopo === "ausente")
    .map((a) => a.perfil_codigo ?? a.tipo_assinatura);
}
