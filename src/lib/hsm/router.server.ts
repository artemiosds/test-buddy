/**
 * HSM Expert — AI Router.
 *
 * Reutiliza integralmente o Gerenciador Universal de Provedores de IA já
 * existente (`piso_ia_cadeia` + `criarProvider`). Nenhuma chave nova, nenhuma
 * variável VITE_*: as credenciais permanecem exclusivamente no servidor.
 *
 * O roteador escolhe automaticamente o provedor mais adequado à intenção e faz
 * fallback em cascata quando um provedor falha.
 */

import { criarProvider, ProviderError, type AIProvider } from "../ai-providers/runtime.server";
import { lerCadeiaProvedores } from "../piso-ia-provedores.functions";

export type Intencao = "rapido" | "tecnico" | "documento" | "analise";

export type RespostaModelo = {
  texto: string;
  modelo: string;
  provedor: string;
  ms: number;
  tentativas: { provedor: string; erro: string }[];
};

/** Peso de afinidade modelo × intenção (heurística de roteamento). */
function afinidade(modelo: string, intencao: Intencao): number {
  const m = modelo.toLowerCase();
  const tem = (...t: string[]) => t.some((x) => m.includes(x));
  switch (intencao) {
    case "tecnico":
      return tem("deepseek") ? 3 : tem("gpt-5", "o3", "claude") ? 2 : 1;
    case "documento":
      return tem("gemma", "llama") ? 3 : tem("claude", "gemini") ? 2 : 1;
    case "analise":
      return tem("llama", "claude", "pro", "gpt-5") ? 3 : tem("gemini") ? 2 : 1;
    case "rapido":
    default:
      return tem("flash", "mini", "nano", "luna") ? 3 : 1;
  }
}

/** Classificador leve e determinístico (sem custo de modelo). */
export function classificarIntencao(pergunta: string): Intencao {
  const p = pergunta.toLowerCase();
  if (/\b(sql|consulta|código|codigo|script|erro|bug|função|api|json)\b/.test(p)) return "tecnico";
  if (/\b(ofício|oficio|memorando|declaração|declaracao|parecer|ata|documento|word|docx|pdf)\b/.test(p))
    return "documento";
  if (/\b(analis|compare|comparar|tendência|tendencia|por que|explique|indicador|divergên)/.test(p))
    return "analise";
  return "rapido";
}

/** Cadeia de provedores ordenada para a intenção, com fallback embutido. */
export async function montarCadeia(supabase: unknown, intencao: Intencao): Promise<AIProvider[]> {
  const cadeia = await lerCadeiaProvedores(supabase as never);
  let cfgs = cadeia.provedores;

  // Sem provedores cadastrados → usa o gateway Lovable já provisionado.
  if (cfgs.length === 0) {
    cfgs = [
      {
        id: "gateway",
        tipo: "lovable",
        nome: "Lovable AI Gateway",
        modelo: "openai/gpt-5.6-sol",
        base_url: null,
        api_key: null,
        timeout_ms: 120000,
        tentativas: 2,
        prioridade: 1,
        extra: {},
      },
    ];
  }

  const ordenados =
    cadeia.modo === "manual"
      ? cfgs
      : [...cfgs].sort(
          (a, b) =>
            afinidade(b.modelo, intencao) - afinidade(a.modelo, intencao) ||
            a.prioridade - b.prioridade,
        );

  return ordenados.map(criarProvider).filter((p) => p.status() === "pronto");
}

/** Executa o prompt na cadeia, caindo para o próximo provedor em caso de falha. */
export async function conversar(opcoes: {
  supabase: unknown;
  intencao: Intencao;
  sistema: string;
  usuario: string;
}): Promise<RespostaModelo> {
  const cadeia = await montarCadeia(opcoes.supabase, opcoes.intencao);
  if (cadeia.length === 0) {
    throw new Error(
      "Nenhum provedor de IA disponível. Cadastre um em Piso da Enfermagem › Motor de Extração › Gerenciador de Provedores de IA.",
    );
  }

  const tentativas: { provedor: string; erro: string }[] = [];
  for (const provider of cadeia) {
    try {
      const r = await provider.processarPDF({
        prompt: opcoes.sistema,
        instrucao: opcoes.usuario,
        paginas: [],
      });
      return {
        texto: r.texto,
        modelo: r.modelo,
        provedor: provider.nome,
        ms: r.ms,
        tentativas,
      };
    } catch (e) {
      tentativas.push({
        provedor: provider.nome,
        erro: e instanceof ProviderError ? e.message : e instanceof Error ? e.message : "falha",
      });
    }
  }
  throw new Error(
    `Todos os provedores de IA falharam. ${tentativas.map((t) => t.erro).join(" | ")}`,
  );
}

/** Extrai o primeiro objeto JSON de uma resposta livre do modelo. */
export function extrairJson<T>(texto: string): T | null {
  const limpo = texto.replace(/```json/gi, "```").trim();
  const bloco = limpo.includes("```") ? limpo.split("```")[1] ?? limpo : limpo;
  const inicio = bloco.indexOf("{");
  const fim = bloco.lastIndexOf("}");
  if (inicio === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(bloco.slice(inicio, fim + 1)) as T;
  } catch {
    return null;
  }
}
