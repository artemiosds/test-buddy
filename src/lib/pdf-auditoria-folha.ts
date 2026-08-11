import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { drawInstitutionalHeader, loadMunicipioInfo } from "./pdf-institucional";

/**
 * Gera PDF da Auditoria Forense do Fluxo de Envio da Folha
 */
export async function gerarPdfAuditoriaFolha() {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const info = await loadMunicipioInfo();
  let currentY = drawInstitutionalHeader(doc, info, "AUDITORIA FORENSE — FLUXO DE ENVIO DA FOLHA");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("1. OBJETIVO", 14, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  const objetivo = "Realizar uma auditoria completa, real e rastreável do fluxo de envio da folha para análise, garantindo a integridade dos dados desde o lançamento da frequência até a homologação final.";
  const linesObjetivo = doc.splitTextToSize(objetivo, 180);
  doc.text(linesObjetivo, 14, currentY);
  currentY += (linesObjetivo.length * 5) + 5;

  doc.setFont("helvetica", "bold");
  doc.text("2. MAPA DO FLUXO ATUAL", 14, currentY);
  currentY += 6;

  const fluxoData = [
    ["1. Lançamento", "Diretor/Responsável lança frequências diárias/mensais."],
    ["2. Fechamento", "Bloqueio de edições na competência ativa."],
    ["3. Geração", "Cálculo e consolidação dos valores da folha."],
    ["4. Envio", "Transição de RASCUNHO para ENVIADA_ANALISE."],
    ["5. Análise", "Revisão técnica pelo Gestor ou Perfil Master."],
    ["6. Homologação", "Status final que autoriza o pagamento/emissão."],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Etapa", "Descrição Detalhada"]],
    body: fluxoData,
    theme: "grid",
    headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.text("3. MATRIZ DE PERMISSÕES E STATUS", 14, currentY);
  currentY += 6;

  const matrizData = [
    ["DIRETOR", "Visualiza Unidade", "Envia p/ Análise", "Corrige Reprovada"],
    ["GESTOR", "Visualiza Secretaria", "Analisa/Reprova", "Aprova"],
    ["MASTER", "Visualiza Global", "Homologa", "Bypassa RLS"],
  ];

  autoTable(doc, {
    startY: currentY,
    head: [["Perfil", "Escopo", "Ações Principais", "Responsabilidade"]],
    body: matrizData,
    theme: "striped",
    headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: "bold" },
    styles: { fontSize: 9 },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.text("4. ACHADOS E PONTOS DE CONTROLE", 14, currentY);
  currentY += 6;

  doc.setFont("helvetica", "normal");
  const achados = [
    "• RLS: Garantir que deleted_at IS NULL esteja em todas as queries de visualização.",
    "• Integridade: Snapshot da frequência no momento do envio para análise.",
    "• Auditoria: Registro de logs (User ID + Timestamp) em cada transição de status.",
  ];
  doc.text(achados, 14, currentY);

  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm:ss")}`, 14, footerY);
  doc.text("HSM Gestão - Auditoria Forense", doc.internal.pageSize.getWidth() - 14, footerY, { align: "right" });

  doc.save(`auditoria_forense_folha_${format(new Date(), "yyyyMMdd")}.pdf`);
}
