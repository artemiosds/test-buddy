/**
 * Parecer Técnico Gerencial do relatório "Geral Cargos", redigido pela IA
 * integrada ao sistema (Lovable AI Gateway — mesma infraestrutura usada na
 * extração de FOPAG / Piso da Enfermagem).
 *
 * A IA recebe SOMENTE números já consolidados; nunca acessa o banco. Se a IA
 * estiver indisponível, o parecer volta com `ia: false` e um resumo de reserva,
 * de modo que a exportação nunca é bloqueada.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  escopo: z.enum(["ativos", "geral"]),
  competencia: z.string().min(1),
  total: z.number().int().nonnegative(),
  ativos: z.number().int().nonnegative(),
  disponivel: z.number().int().nonnegative(),
  efetivos: z.number().int().nonnegative(),
  prestadores: z.number().int().nonnegative(),
  prestadoresServico: z.number().int().nonnegative(),
  comissionados: z.number().int().nonnegative(),
  terceirizados: z.number().int().nonnegative(),
  afastamentos: z
    .array(z.object({ label: z.string(), qtd: z.number().int().nonnegative(), cargos: z.array(z.string()) }))
    .max(30),
  topCargos: z
    .array(z.object({ nome: z.string(), total: z.number().int().nonnegative() }))
    .max(15),
});

export type ParecerInput = z.infer<typeof Input>;

const MODELO = "openai/gpt-6-astra";

function pct(parte: number, todo: number) {
  if (!todo) return "0,0%";
  return `${((parte / todo) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

/** Resumo de reserva: usado apenas quando a IA falha. */
export function parecerReserva(d: ParecerInput): string[] {
  const baseVinculo = d.efetivos + d.prestadores;
  const topAfast = [...d.afastamentos].sort((a, b) => b.qtd - a.qtd).slice(0, 3);
  return [
    `Escopo analisado: ${d.escopo === "ativos" ? "somente profissionais ativos (ativo, férias e licença prêmio)" : "quadro completo de cadastros"}, competência ${d.competencia}.`,
    `Composição do vínculo: ${d.efetivos} efetivos (${pct(d.efetivos, baseVinculo)}) e ${d.prestadores} prestadores/contratados (${pct(d.prestadores, baseVinculo)}), destes ${d.prestadoresServico} prestadores de serviço, ${d.comissionados} comissionados e ${d.terceirizados} terceirizados.`,
    `Disponibilidade para escala: ${d.disponivel} de ${d.ativos} ativos (${pct(d.disponivel, d.ativos)}); ${Math.max(0, d.ativos - d.disponivel)} profissionais estão temporariamente fora de escala por férias ou licença prêmio.`,
    topAfast.length
      ? `Principais ausências: ${topAfast.map((a) => `${a.label} (${a.qtd})`).join(", ")}. Cargos mais afetados: ${topAfast.flatMap((a) => a.cargos).slice(0, 6).join(", ") || "não informado"}.`
      : "Não há afastamentos registrados no escopo analisado.",
  ];
}

function prompt(d: ParecerInput): string {
  return [
    "Você é analista de gestão de pessoas de uma Secretaria Municipal de Saúde.",
    "Redija um PARECER TÉCNICO GERENCIAL sobre o quadro da força de trabalho.",
    "",
    "REGRAS:",
    "- 3 a 5 parágrafos curtos, em português formal e impessoal, sem markdown, sem títulos, sem listas.",
    "- Use EXCLUSIVAMENTE os números fornecidos abaixo. Nunca invente valores, percentuais que não possam ser calculados a partir deles, nem cite fontes externas.",
    "- Aborde obrigatoriamente: (1) proporção entre efetivos e prestadores de serviço; (2) taxa de disponibilidade para escala e o impacto de férias e licenças; (3) principais gargalos de afastamento e os cargos mais afetados.",
    "- Encerre com uma recomendação gerencial objetiva.",
    "- Separe os parágrafos com uma linha em branco.",
    "",
    "DADOS CONSOLIDADOS (JSON):",
    JSON.stringify(d),
  ].join("\n");
}

/** Lê o texto final de uma resposta SSE do endpoint /v1/responses. */
async function lerStream(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const dec = new TextDecoder();
  let buffer = "";
  let texto = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += dec.decode(value, { stream: true });
    const partes = buffer.split("\n");
    buffer = partes.pop() ?? "";
    for (const linha of partes) {
      if (!linha.startsWith("data:")) continue;
      const bruto = linha.slice(5).trim();
      if (!bruto || bruto === "[DONE]") continue;
      try {
        const ev = JSON.parse(bruto) as {
          type?: string;
          delta?: string;
          response?: { output_text?: string };
        };
        if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
          texto += ev.delta;
        } else if (ev.type === "response.completed" && ev.response?.output_text) {
          if (!texto) texto = ev.response.output_text;
        }
      } catch {
        // evento parcial/desconhecido — ignorado
      }
    }
  }
  return texto.trim();
}

export const gerarParecerGeralCargos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ paragrafos: string[]; ia: boolean; aviso?: string }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      return {
        paragrafos: parecerReserva(data),
        ia: false,
        aviso: "Parecer não assinado por IA nesta emissão (serviço de IA não configurado).",
      };
    }

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: MODELO,
          input: prompt(data),
          stream: true,
          reasoning: { effort: "low", summary: "auto" },
          store: false,
        }),
      });

      if (!res.ok) {
        const detalhe = await res.text().catch(() => "");
        console.error("[geral-cargos] parecer IA falhou", res.status, detalhe.slice(0, 300));
        return {
          paragrafos: parecerReserva(data),
          ia: false,
          aviso:
            res.status === 402
              ? "Parecer não assinado por IA nesta emissão (créditos de IA esgotados)."
              : `Parecer não assinado por IA nesta emissão (falha ${res.status}).`,
        };
      }

      const texto = await lerStream(res);
      const paragrafos = texto
        .split(/\n{2,}/)
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length > 30);

      if (!paragrafos.length) {
        return {
          paragrafos: parecerReserva(data),
          ia: false,
          aviso: "Parecer não assinado por IA nesta emissão (resposta vazia).",
        };
      }
      return { paragrafos, ia: true };
    } catch (e) {
      console.error("[geral-cargos] parecer IA erro", e);
      return {
        paragrafos: parecerReserva(data),
        ia: false,
        aviso: "Parecer não assinado por IA nesta emissão (serviço indisponível).",
      };
    }
  });
