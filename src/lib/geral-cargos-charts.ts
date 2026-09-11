/**
 * Gráficos do relatório "Geral Cargos" renderizados em PNG (canvas do
 * navegador) para embutir no documento Word. Usa a mesma paleta dos painéis
 * de Relatórios Gerenciais.
 */

export const PALETA_GRAFICO = [
  "#5c4020",
  "#b0844a",
  "#2e6960",
  "#608ba8",
  "#976a7a",
  "#7a8a54",
  "#b4a078",
  "#6e6e7a",
];

export type PontoGrafico = { label: string; valor: number };

function ctx2d(largura: number, altura: number) {
  const canvas = document.createElement("canvas");
  const escala = 2;
  canvas.width = largura * escala;
  canvas.height = altura * escala;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.scale(escala, escala);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, largura, altura);
  return { canvas, ctx };
}

async function paraPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar o gráfico."))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

/** Barras horizontais — Top N cargos. */
export async function pngBarras(
  dados: PontoGrafico[],
  opts: { largura?: number; altura?: number } = {},
): Promise<{ png: Uint8Array; largura: number; altura: number }> {
  const itens = [...dados].filter((d) => d.valor > 0).sort((a, b) => b.valor - a.valor);
  const largura = opts.largura ?? 620;
  const altura = opts.altura ?? Math.max(140, 26 + itens.length * 22);
  const { canvas, ctx } = ctx2d(largura, altura);
  const maior = Math.max(1, ...itens.map((d) => d.valor));
  const rotuloLarg = 190;
  const barraMax = largura - rotuloLarg - 60;

  ctx.font = "11px Arial";
  itens.forEach((d, i) => {
    const y = 14 + i * 22;
    ctx.fillStyle = "#333333";
    ctx.textAlign = "right";
    const nome = d.label.length > 30 ? `${d.label.slice(0, 29)}…` : d.label;
    ctx.fillText(nome, rotuloLarg - 8, y + 11);
    const w = Math.max(2, (d.valor / maior) * barraMax);
    ctx.fillStyle = PALETA_GRAFICO[i % PALETA_GRAFICO.length]!;
    ctx.fillRect(rotuloLarg, y, w, 14);
    ctx.fillStyle = "#333333";
    ctx.textAlign = "left";
    ctx.fillText(String(d.valor), rotuloLarg + w + 6, y + 11);
  });

  return { png: await paraPng(canvas), largura, altura };
}

/** Rosca — composição por vínculo. */
export async function pngRosca(
  dados: PontoGrafico[],
  opts: { largura?: number; altura?: number } = {},
): Promise<{ png: Uint8Array; largura: number; altura: number }> {
  const itens = dados.filter((d) => d.valor > 0);
  const largura = opts.largura ?? 480;
  const altura = opts.altura ?? 240;
  const { canvas, ctx } = ctx2d(largura, altura);
  const total = itens.reduce((a, d) => a + d.valor, 0) || 1;
  const cx = 120;
  const cy = altura / 2;
  const raio = Math.min(cy - 16, 96);

  let ang = -Math.PI / 2;
  itens.forEach((d, i) => {
    const fim = ang + (d.valor / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, raio, ang, fim);
    ctx.closePath();
    ctx.fillStyle = PALETA_GRAFICO[i % PALETA_GRAFICO.length]!;
    ctx.fill();
    ang = fim;
  });
  ctx.beginPath();
  ctx.arc(cx, cy, raio * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.font = "12px Arial";
  ctx.textAlign = "left";
  itens.forEach((d, i) => {
    const y = 30 + i * 22;
    ctx.fillStyle = PALETA_GRAFICO[i % PALETA_GRAFICO.length]!;
    ctx.fillRect(cx + raio + 24, y - 9, 11, 11);
    ctx.fillStyle = "#333333";
    const p = ((d.valor / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    ctx.fillText(`${d.label}: ${d.valor} (${p}%)`, cx + raio + 42, y);
  });

  return { png: await paraPng(canvas), largura, altura };
}
