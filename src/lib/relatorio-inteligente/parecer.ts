/**
 * Parecer Técnico automático por bloco.
 * Analisa estatísticas, concentração, gaps e produz frases legíveis.
 * 100% derivado dos dados já construídos — nenhuma nova consulta.
 */
import type { BlockDef, Row } from "./tipos";
import { statsFor, numericFields } from "./agregacoes";

export type ParecerBloco = {
  blockId: string;
  titulo: string;
  frases: string[];
  destaques: { rotulo: string; valor: string; tom?: "positivo" | "atencao" | "critico" }[];
};

export function parecerPorBloco(block: BlockDef, rows: Row[], fields: string[]): ParecerBloco {
  const frases: string[] = [];
  const destaques: ParecerBloco["destaques"] = [];

  const nomeCat = block.fields.find((f) => f.tipo !== "number" && fields.includes(f.id))?.id;
  const nums = numericFields(rows).filter((f) => fields.includes(f));

  if (!rows.length) {
    return { blockId: block.id, titulo: block.label, frases: ["Sem dados suficientes para análise."], destaques: [] };
  }

  frases.push(`O bloco reúne ${rows.length.toLocaleString("pt-BR")} registro(s) após aplicação dos filtros e ordenação.`);

  for (const f of nums.slice(0, 3)) {
    const s = statsFor(rows, f);
    const rot = block.fields.find((x) => x.id === f)?.label ?? f;
    if (!s.total) continue;

    frases.push(
      `**${rot}** apresenta soma de ${s.soma.toLocaleString("pt-BR")}, ` +
      `média de ${s.media.toLocaleString("pt-BR")} e mediana ${s.mediana.toLocaleString("pt-BR")} ` +
      `(desvio padrão ${s.desvio.toLocaleString("pt-BR")}, mín ${s.minimo.toLocaleString("pt-BR")}, máx ${s.maximo.toLocaleString("pt-BR")}).`,
    );

    // Concentração — top 3 categorias respondem por quanto do total?
    if (nomeCat && s.soma > 0) {
      const bucket = new Map<string, number>();
      for (const r of rows) {
        const k = r[nomeCat] == null ? "—" : String(r[nomeCat]);
        const v = typeof r[f] === "number" ? (r[f] as number) : 0;
        bucket.set(k, (bucket.get(k) ?? 0) + v);
      }
      const ranked = [...bucket.entries()].sort((a, b) => b[1] - a[1]);
      const top3 = ranked.slice(0, 3).reduce((sum, [, v]) => sum + v, 0);
      const pct = Math.round((top3 / s.soma) * 100);
      if (ranked.length >= 3) {
        const nomes = ranked.slice(0, 3).map(([k]) => k).join(", ");
        frases.push(`Os três maiores (${nomes}) concentram ${pct}% do total de ${rot.toLowerCase()}.`);
        destaques.push({
          rotulo: `Concentração top 3 · ${rot}`,
          valor: `${pct}%`,
          tom: pct >= 70 ? "critico" : pct >= 50 ? "atencao" : "positivo",
        });
      }
    }

    // Dispersão relativa (coef. de variação).
    if (s.media > 0) {
      const cv = Math.round((s.desvio / s.media) * 100);
      if (cv >= 80) frases.push(`Dispersão elevada em ${rot.toLowerCase()} (CV ${cv}%): há grande desigualdade entre categorias.`);
      else if (cv <= 20 && s.total > 3) frases.push(`Distribuição homogênea em ${rot.toLowerCase()} (CV ${cv}%).`);
    }
  }

  // Gaps de preenchimento.
  if (nomeCat) {
    const vazios = rows.filter((r) => r[nomeCat] == null || r[nomeCat] === "").length;
    if (vazios > 0) {
      const pct = Math.round((vazios / rows.length) * 100);
      frases.push(`Há ${vazios.toLocaleString("pt-BR")} registro(s) (${pct}%) sem o campo categórico "${block.fields.find((f) => f.id === nomeCat)?.label}" preenchido.`);
      destaques.push({
        rotulo: "Registros sem categoria",
        valor: `${pct}%`,
        tom: pct >= 20 ? "critico" : pct >= 5 ? "atencao" : "positivo",
      });
    }
  }

  return { blockId: block.id, titulo: block.label, frases, destaques };
}