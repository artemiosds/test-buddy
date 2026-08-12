/**
 * OCR inteligente do FOPAG por IA de Visão (Lovable AI Gateway).
 *
 * Server-only: a chave nunca chega ao navegador. Usada apenas quando o PDF é
 * escaneado / sem texto pesquisável. Devolve exclusivamente JSON estruturado.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensurePermission } from "./authz.server";

/**
 * Modelo configurável (sem hardcode no fluxo): definido por secret/env do
 * ambiente. O fallback existe apenas para não quebrar em ambiente novo.
 */
const MODELO_PADRAO = "openai/gpt-5.6-sol";
/** Versão do prompt — registrada na auditoria para rastreabilidade. */
export const PROMPT_VERSAO = "fopag-visao-2026.08";

function modeloConfigurado(): string {
  return (process.env.PISO_FOPAG_MODELO_IA ?? process.env.LOVABLE_AI_MODEL ?? MODELO_PADRAO).trim();
}

/** Forma serializável do bloco devolvido pela IA (normalizado no cliente). */
export type FuncionarioIA = Record<
  string,
  string | number | null | Record<string, string | number | null>
>;

const Input = z.object({
  /** Páginas em JPEG base64 (sem prefixo data:) de um mesmo trecho contínuo. */
  paginas: z
    .array(z.object({ pagina: z.number().int().positive(), base64: z.string().min(100) }))
    .min(1)
    .max(24),
  competencia_hint: z.string().nullable().optional(),
});

const PROMPT = `Você lê contracheques/FOPAG de prefeitura municipal e devolve DADOS ESTRUTURADOS.

REGRAS OBRIGATÓRIAS:
1. Responda EXCLUSIVAMENTE com JSON válido. Nunca texto livre, nunca markdown.
2. Cada funcionário é um BLOCO independente que começa em "Funcionário(a)" ou "Funcionário" e termina antes do próximo. NUNCA misture rubricas entre funcionários.
3. O bloco pode começar por "Funcionário(a)", "Funcionário", "Servidor(a)", "Servidor", "Colaborador", "Empregado", "Nome", "Nome do Servidor", "Servidor(a)", "Matrícula", "Cargo", "Lotação", "Ficha Funcional" ou "Registro" — ou estrutura equivalente sem rótulo. Compreenda o layout, não dependa de uma palavra fixa. Preserve a continuidade lógica do documento: as imagens enviadas são páginas consecutivas do MESMO contracheque. Se um bloco de funcionário começar em uma página e continuar na(s) seguinte(s), una automaticamente todas as informações (rubricas, totais, cargo, CPF) em UM ÚNICO registro, nunca em dois. Nunca crie um registro novo a partir de uma continuação sem cabeçalho de identificação.
4. Extraia SOMENTE profissionais da enfermagem (Enfermeiro(a), Técnico/Técnica de Enfermagem, Auxiliar de Enfermagem, incluindo abreviações como TEC. ENF., AUX. ENFERMAGEM). Ignore completamente qualquer outro cargo (médico, dentista, motorista, professor, administrativo, etc.).
5. Ordem de decisão para aceitar o registro: Cargo > CPF > Matrícula > Rubricas > Complemento Piso. O cargo é sempre o critério principal.
6. Para os valores financeiros use SEMPRE a coluna "Integral". Nunca use Base, Referência ou Percentual (exceto para o campo dias_trabalhados).
7. Rubrica ausente para o funcionário => 0. Nunca invente valores.
8. Valores numéricos em ponto decimal (2544.02). CPF apenas dígitos (03106793201).

9. Tolere carimbos, assinaturas, marcas d'água, linhas tortas, páginas fora de ordem, rubricas em ordem diferente e nomenclaturas/abreviações distintas entre municípios. Não exija um layout fixo.
10. Cada campo (identificação e rubricas) deve ser devolvido como {"valor": ..., "confidence": 0..1} com a confiança INDIVIDUAL daquele campo. Nunca devolva apenas uma confiança geral.

FORMATO EXATO:
{
  "competencia": "YYYY-MM",
  "funcionarios": [
    {
      "nome": { "valor": "", "confidence": 0.98 },
      "cargo": { "valor": "", "confidence": 0.98 },
      "cpf": { "valor": "", "confidence": 0.98 },
      "matricula": { "valor": "", "confidence": 0.98 },
      "pagina": 1,
      "rubricas": {
        "salario_base": { "valor": 0, "confidence": 0.98 },
        "dias_trabalhados": { "valor": 30, "origem": "referencia_linha_salario_base", "confidence": 0.98 },
        "tempo_servico": { "valor": 0, "confidence": 0.98 },
        "insalubridade": { "valor": 0, "confidence": 0.98 },
        "adicional_noturno": { "valor": 0, "confidence": 0.98 },
        "hora_extra_100": { "valor": 0, "confidence": 0.98 },
        "hora_extra_50": { "valor": 0, "confidence": 0.98 },
        "plantao": { "valor": 0, "confidence": 0.98 },
        "sobreaviso": { "valor": 0, "confidence": 0.98 },
        "vale_transporte": { "valor": 0, "confidence": 0.98 },
        "grat_funcao_vr": { "valor": 0, "confidence": 0.98 },
        "grat_funcao_pct": { "valor": 0, "confidence": 0.98 },
        "grat_nivel_superior": { "valor": 0, "confidence": 0.98 },
        "incentivos": { "valor": 0, "confidence": 0.98 },
        "aux_financeiro": { "valor": 0, "confidence": 0.98 },
        "inss": { "valor": 0, "confidence": 0.98 },
        "irrf": { "valor": 0, "confidence": 0.98 },
        "outros_descontos": { "valor": 0, "descricao": "nome do desconto", "confidence": 0.98 },
        "adn_informativo": { "valor": 0, "confidence": 0.98 },
        "total_positivos": { "valor": 0, "formula": "SOMA(campos B:P)" },
        "total_desconto": { "valor": 0, "formula": "INSS + IRRF" },
        "total_proventos_folha": { "valor": 0, "confidence": 0.98 },
        "total_descontos_folha": { "valor": 0, "confidence": 0.98 },
        "valor_liquido_folha": { "valor": 0, "confidence": 0.98 }
      }
    }
  ]
}

DICIONÁRIO DE NORMALIZAÇÃO (rubrica → campo):
salario_base        ← "1 - SALARIO BASE", tipo (P)-Dia
dias_trabalhados    ← EXTRAÇÃO OBRIGATÓRIA: localize a linha do Salário Base cujo campo "Tipo" ou "Classe" seja "(P) - Dia" ou similar. Extraia o valor numérico EXATAMENTE da coluna "Referência" dessa linha. NUNCA use o valor monetário integral para este campo. Se não encontrar a referência específica de dias, deixe null.
tempo_servico       ← "GRATIFICACAO TEMPO SERVICO", "ANUENIO", "ADIC. TEMPO"
insalubridade       ← "INSALUBRIDADE"
adicional_noturno   ← "ADICIONAL NOTURNO", "AD. NOT."
hora_extra_50       ← rubrica contendo "50%"
hora_extra_100      ← rubrica contendo "100%"
plantao             ← "PLANTAO", "PLANTÃO"
sobreaviso          ← "SOBREAVISO"
vale_transporte     ← "VALE TRANSPORTE", "VT"
grat_funcao_vr      ← "GRATIFICACAO FUNCAO (VR)"
grat_funcao_pct     ← gratificação de função calculada em % do vencimento base
grat_nivel_superior ← "GRATIF. DE NIVEL SUPERIOR", "GRAT NIVEL SUP"
incentivos          ← rubrica nomeada "INCENTIVO" (produtividade/meta) - NUNCA o complemento do piso
aux_financeiro      ← "COMPLEMENTO FINANCEIRO PISO ENFERMAGEM", "AUX FINANC PISO", "COMPL PISO"
inss                ← "I.N.S.S", tipo Desconto-Tabela
irrf                ← "I.R.R.F", tipo Desconto-Tabela
outros_descontos    ← qualquer desconto que não seja INSS/IRRF (convênio, consignado, empréstimo, etc.)
adn_informativo     ← campos patronais tipo "Base Patronal RGPS"`;

function mensagemFalha(status: number, detalhe: string): string {
  if (status === 429) {
    return "Limite de uso da IA atingido. Aguarde alguns instantes e tente novamente.";
  }
  if (status === 402) {
    return "Créditos de IA esgotados. Adicione créditos ao workspace para continuar.";
  }
  if (status === 503 || status === 529) {
    return "O modelo de IA está sobrecarregado no momento (503). Já tentamos novamente algumas vezes sem sucesso. Aguarde 1–2 minutos e reenvie, ou troque o modelo em Piso da Enfermagem › Motor de Extração.";
  }
  if (status >= 500) {
    return `O provedor de IA está instável no momento [${status}]. Tente novamente em instantes.`;
  }
  return `Falha na leitura por IA [${status}]: ${detalhe.slice(0, 300)}`;
}

export const extrairFopagPorIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await ensurePermission(context.supabase, context.userId, "piso.importar");

    const { criarProvider, ProviderError } = await import("./ai-providers/runtime.server");
    const { lerCadeiaProvedores } = await import("./piso-ia-provedores.functions");

    // Cadeia de provedores (Gerenciador de Provedores de IA), por prioridade.
    let cadeia = await lerCadeiaProvedores(context.supabase as never);

    // Compatibilidade: se ainda não houver provedores cadastrados, cai na
    // configuração legada do Motor de Extração (Gemini / Lovable Gateway).
    if (cadeia.provedores.length === 0) {
      const { lerConfigExtracao, lerChaveIA } = await import("./piso-extracao-config.functions");
      const cfg = await lerConfigExtracao(context.supabase as never);
      if (!cfg.ia_habilitada) {
        throw new Error(
          "Nenhum provedor de IA ativo. Cadastre um em Piso da Enfermagem › Motor de Extração › Gerenciador de Provedores de IA.",
        );
      }
      const tipo = cfg.ia_fornecedor === "lovable" ? "lovable" : "gemini";
      cadeia = {
        modo: "automatico",
        provedores: [
          {
            id: "legado",
            tipo,
            nome: tipo === "lovable" ? "Lovable AI Gateway" : "Google Gemini",
            modelo: (cfg.ia_modelo || modeloConfigurado()).trim(),
            base_url: null,
            api_key:
              tipo === "gemini" ? ((await lerChaveIA(context.supabase as never)) ?? null) : null,
            timeout_ms: 120000,
            tentativas: 3,
            prioridade: 1,
            extra: {},
          },
        ],
      };
    }

    const instrucao = data.competencia_hint
      ? `Competência esperada: ${data.competencia_hint}. Extraia os funcionários das imagens a seguir.`
      : "Extraia os funcionários das imagens a seguir.";

    const registrarMetrica = async (
      id: string,
      ok: boolean,
      ms: number,
      status: number,
      erro: string | null,
    ) => {
      if (id === "legado") return;
      try {
        await (
          context.supabase as never as {
            rpc: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
          }
        ).rpc("piso_ia_provedor_metrica", {
          _id: id,
          _ok: ok,
          _ms: ms,
          _status: status,
          _erro: erro,
          _confianca: null,
          _pdfs: ok ? 1 : 0,
        });
      } catch {
        // telemetria nunca derruba a importação
      }
    };

    let texto = "";
    let usado = "";
    const tentados: { provedor: string; status: number; erro: string }[] = [];

    // FAILOVER AUTOMÁTICO: percorre a cadeia até um provedor responder.
    for (const cfg of cadeia.provedores) {
      const provider = criarProvider(cfg as never);
      const inicio = Date.now();
      try {
        const r = await provider.processarPDF({ prompt: PROMPT, instrucao, paginas: data.paginas });
        texto = (r.texto || "").trim();
        usado = `${cfg.tipo}:${provider.modelo}`;
        await registrarMetrica(cfg.id, true, r.ms, 200, null);
        break;
      } catch (e) {
        const status = e instanceof ProviderError ? e.status : 0;
        const msg = e instanceof Error ? e.message : String(e);
        tentados.push({ provedor: provider.nome, status, erro: msg });
        await registrarMetrica(cfg.id, false, Date.now() - inicio, status, msg);
      }
    }

    if (!texto) {
      const resumo = tentados.map((t) => `${t.provedor} [${t.status || "rede"}]`).join(" › ");
      const ultimo = tentados[tentados.length - 1];
      throw new Error(
        tentados.length > 1
          ? `Todos os provedores de IA falharam (${resumo}). ${mensagemFalha(ultimo?.status ?? 0, ultimo?.erro ?? "")}`
          : (ultimo?.erro ?? "Falha na leitura por IA."),
      );
    }

    let payload: { competencia?: string | null; funcionarios?: unknown[] };
    try {
      payload = JSON.parse(texto);
    } catch {
      const bloco = texto.match(/\{[\s\S]*\}/);
      if (!bloco) throw new Error("A IA não devolveu JSON estruturado para estas páginas.");
      payload = JSON.parse(bloco[0]);
    }

    const funcionarios = (
      Array.isArray(payload.funcionarios) ? payload.funcionarios : []
    ) as FuncionarioIA[];

    return {
      competencia: (payload.competencia ?? null) as unknown as string | null,
      funcionarios,
      modelo: usado,
      promptVersao: PROMPT_VERSAO,
      /** JSON bruto da IA — preservado para auditoria e rastreabilidade. */
      bruto: texto.slice(0, 200_000),
      /** Provedores que falharam antes do sucesso (failover). */
      tentativas_falhas: tentados,
      paginas: data.paginas.map((p) => p.pagina),
    };
  });