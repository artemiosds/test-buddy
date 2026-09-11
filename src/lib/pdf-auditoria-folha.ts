import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { drawInstitutionalHeader, loadMunicipioInfo } from "./pdf-institucional";
import { resolverAssinaturasDocumento } from "./pdf-assinaturas";
import { finalizarPdf } from "./pdf-pipeline";
import { supabase } from "@/integrations/supabase/client";
import { detectarAchados, TEXTO_SEM_ACHADOS, type LinhaTrilha } from "./auditoria-achados";

/**
 * Gera PDF da Auditoria Forense do Fluxo de Envio da Folha
 * @param opts.dias janela analisada para os achados automáticos (padrão 30)
 * @param opts.observacoes observações manuais do auditor (opcional)
 */
export async function gerarPdfAuditoriaFolha(opts?: { dias?: number; observacoes?: string }) {
  const dias = opts?.dias ?? 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);

  const { data: trilha } = await supabase
    .from("audit_log")
    .select("ocorrido_em, operacao, tabela, registro_id, usuario_id, usuario_email, ip")
    .gte("ocorrido_em", desde.toISOString())
    .order("ocorrido_em", { ascending: false })
    .limit(5000);

  const achados = detectarAchados((trilha ?? []) as LinhaTrilha[]);


  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const MARGEM = 14;
  const LARGURA = PW - MARGEM * 2;
  /** Zona reservada ao rodapé institucional — nada pode ser escrito abaixo. */
  const LIMITE = PH - 22;

  const info = await loadMunicipioInfo();
  let currentY = drawInstitutionalHeader(doc, info, "AUDITORIA FORENSE — FLUXO DE ENVIO DA FOLHA");
  const topoConteudo = currentY;

  /** Garante espaço útil; abre nova página (com cabeçalho) quando necessário. */
  const garantirEspaco = (altura: number) => {
    if (currentY + altura <= LIMITE) return;
    doc.addPage();
    currentY = drawInstitutionalHeader(doc, info, "AUDITORIA FORENSE — FLUXO DE ENVIO DA FOLHA");
  };

  const titulo = (texto: string) => {
    garantirEspaco(16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(texto, MARGEM, currentY);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(MARGEM, currentY + 1.6, PW - MARGEM, currentY + 1.6);
    currentY += 7;
  };

  const paragrafo = (texto: string, tamanho = 9.5) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tamanho);
    doc.setTextColor(0, 0, 0);
    const linhas = doc.splitTextToSize(texto, LARGURA) as string[];
    garantirEspaco(linhas.length * 4.6 + 2);
    doc.text(linhas, MARGEM, currentY);
    currentY += linhas.length * 4.6 + 4;
  };

  const tabela = (
    head: string[],
    body: (string | number)[][],
    extra: Record<string, unknown> = {},
  ) => {
    garantirEspaco(24);
    autoTable(doc, {
      startY: currentY,
      head: [head],
      body: body as never,
      theme: "grid",
      headStyles: { fillColor: [232, 232, 232], textColor: 0, fontStyle: "bold", lineColor: 0, lineWidth: 0.15 },
      bodyStyles: { textColor: 0, lineColor: 0, lineWidth: 0.15 },
      styles: { fontSize: 8.5, cellPadding: 2.2, overflow: "linebreak" },
      rowPageBreak: "avoid",
      margin: { left: MARGEM, right: MARGEM, top: topoConteudo, bottom: PH - LIMITE },
      didDrawPage: () => {
        /* páginas geradas pela tabela já entram com margem superior reservada */
      },
      ...extra,
    });
    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  };

  const contagem = {
    alto: achados.filter((a) => a.nivel === "alto").length,
    medio: achados.filter((a) => a.nivel === "medio").length,
    baixo: achados.filter((a) => a.nivel !== "alto" && a.nivel !== "medio").length,
  };

  // ---------------------------------------------------------------- 1
  titulo("1. OBJETIVO E ESCOPO");
  paragrafo(
    "Auditoria completa, real e rastreável do fluxo de envio da folha para análise, garantindo a integridade dos dados desde o lançamento da frequência até a homologação final. Documento de fé pública emitido pelo sistema HSM Gestão, com registro de validação institucional no rodapé.",
  );
  tabela(
    ["Item", "Conteúdo"],
    [
      ["Janela analisada", `Últimos ${dias} dias (desde ${format(desde, "dd/MM/yyyy")})`],
      ["Registros avaliados", `${(trilha ?? []).length} eventos da trilha de operações`],
      ["Emissão", format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss")],
      [
        "Resumo dos achados",
        `${contagem.alto} de criticidade alta · ${contagem.medio} média · ${contagem.baixo} informativos`,
      ],
    ],
    { columnStyles: { 0: { cellWidth: 42, fontStyle: "bold" } } },
  );

  // ---------------------------------------------------------------- 2
  titulo("2. MAPA DO FLUXO OFICIAL");
  tabela(
    ["Etapa", "Descrição detalhada", "Responsável"],
    [
      ["1. Lançamento", "Lançamento das frequências mensais na folha da unidade.", "Diretor de Unidade"],
      ["2. Fechamento", "Encerramento do prazo e bloqueio de edições na competência.", "Gestor / Master"],
      ["3. Geração", "Cálculo e consolidação dos valores da folha.", "Sistema"],
      ["4. Envio", "Transição de RASCUNHO para ENVIADA para análise.", "Diretor de Unidade"],
      ["5. Análise", "Revisão técnica, devolução ou rejeição por linha.", "Gestor / Master"],
      ["6. Homologação", "Status final que autoriza o pagamento e a emissão oficial.", "Master"],
    ],
    { columnStyles: { 0: { cellWidth: 32, fontStyle: "bold" }, 2: { cellWidth: 36 } } },
  );

  // ---------------------------------------------------------------- 3
  titulo("3. MATRIZ DE PERMISSÕES E STATUS");
  tabela(
    ["Perfil", "Escopo de visão", "Ações principais", "Responsabilidade"],
    [
      ["DIRETOR", "Apenas a própria unidade", "Lança e envia para análise", "Corrige linhas devolvidas"],
      ["GESTOR", "Secretaria completa", "Analisa, devolve e aprova", "Conferência técnica"],
      ["MASTER", "Visão global", "Homologa e reabre prazos", "Guarda da integridade"],
    ],
    { columnStyles: { 0: { cellWidth: 24, fontStyle: "bold" } } },
  );

  // ---------------------------------------------------------------- 4
  titulo("4. ACHADOS E PONTOS DE CONTROLE");
  if (achados.length === 0) {
    paragrafo(TEXTO_SEM_ACHADOS);
  } else {
    tabela(
      ["Criticidade", "Achado", "Ocorr.", "Ponto de controle"],
      achados.map((a) => [
        a.nivel === "alto" ? "ALTA" : a.nivel === "medio" ? "MÉDIA" : "INFORM.",
        a.titulo,
        String(a.ocorrencias),
        a.detalhe,
      ]),
      {
        styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
        columnStyles: {
          0: { cellWidth: 20, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 42 },
          2: { cellWidth: 14, halign: "center" },
        },
      },
    );
  }

  // ---------------------------------------------------------------- 5
  titulo("5. OBSERVAÇÕES DO AUDITOR");
  const obs = (opts?.observacoes ?? "").trim() || "Nenhuma observação manual registrada pelo auditor.";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const linhasObs = doc.splitTextToSize(obs, LARGURA - 6) as string[];
  const alturaBox = linhasObs.length * 4.6 + 8;
  garantirEspaco(alturaBox + 4);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(MARGEM, currentY - 4, LARGURA, alturaBox);
  doc.text(linhasObs, MARGEM + 3, currentY + 1);
  currentY += alturaBox + 6;

  // ---------------------------------------------------------------- 6
  titulo("6. ASSINATURAS");
  const assinaturas = await resolverAssinaturasDocumento("relatorio");

  // Reserva o espaço físico do bloco de assinaturas (imagem + linha + nome)
  const ALTURA_BLOCO = 40;
  garantirEspaco(ALTURA_BLOCO + 6);
  const assinaturaBaseY = currentY + 4;

  // Linhas de fé pública desenhadas sempre — mesmo sem carimbo cadastrado,
  // o documento sai assinável. As imagens são injetadas pelo pipeline.
  if (assinaturas.length === 0) {
    const largura = 70;
    const y = assinaturaBaseY + 22;
    const xs = [MARGEM + 8, PW - MARGEM - 8 - largura];
    const rotulos = ["Auditor responsável", "Gestor / Administrador Master"];
    xs.forEach((x, i) => {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(x, y, x + largura, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(rotulos[i], x + largura / 2, y + 4, { align: "center" });
    });
  }
  currentY = assinaturaBaseY + ALTURA_BLOCO;

  // ---------------------------------------------------------- rodapé
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const footerY = PH - 12;
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.15);
    doc.line(MARGEM, footerY - 4, PW - MARGEM, footerY - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, MARGEM, footerY);
    doc.text("HSM Gestão — Auditoria Forense", PW / 2, footerY, { align: "center" });
    doc.text(`Página ${p} de ${total}`, PW - MARGEM, footerY, { align: "right" });
  }
  doc.setPage(total);
  doc.setTextColor(0, 0, 0);

  await finalizarPdf(doc, {
    filename: `auditoria_forense_folha_${format(new Date(), "yyyyMMdd")}.pdf`,
    tipo: "relatorio",
    assinaturas,
    yPadraoMm: assinaturaBaseY,
    pagina: total,
    repetirEmTodasPaginas: false,
  });
}
