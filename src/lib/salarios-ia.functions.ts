import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Interface para os dados salariais extraídos pela IA.
 */
export interface SalarioExtraido {
  identificador: string; // matrícula ou CPF
  nome?: string;
  salario_base: number | null;
  salario_bruto: number | null;
  salario_liquido: number | null;
  horas_extras: number | null;
  adicional_noturno: number | null;
  gratificacao_incentivo: number | null;
  vencimento_liquido: number | null;
}

/**
 * Função de servidor para processar o texto do PDF via IA.
 * Reutiliza o Gerenciador de Provedores de IA para failover e seleção manual.
 */
export const extrairSalariosPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        texto: z.string().min(10),
        provedorId: z.string().uuid().nullable().optional(),
        permitirFailover: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { criarProvider, ProviderError } = await import("./ai-providers/runtime.server");
    const { lerCadeiaProvedores } = await import("./piso-ia-provedores.functions");

    // 1. Obter cadeia de provedores configurada
    let cadeia = await lerCadeiaProvedores(context.supabase as never);

    if (!cadeia.provedores.length) {
      throw new Error("Nenhum provedor de IA ativo. Configure no Gerenciador de Provedores.");
    }

    // 2. Definir lista de execução baseada no modo
    // O Gerenciador já filtra inativos na chain ou devolve o status, mas aqui usamos a chain que inclui chaves.
    let provedoresParaUsar = [...cadeia.provedores];

    if (data.provedorId) {
      const manual = provedoresParaUsar.find(p => p.id === data.provedorId);
      if (!manual) throw new Error("Provedor selecionado não foi encontrado.");
      
      if (data.permitirFailover) {
        // Começa pelo manual, depois segue a ordem original de prioridade
        const outros = provedoresParaUsar.filter(p => p.id !== data.provedorId);
        provedoresParaUsar = [manual, ...outros];
      } else {
        provedoresParaUsar = [manual];
      }
    }

    const prompt = `Você é um especialista em processamento de folha de pagamento.
Extraia os dados de CADA profissional na tabela e retorne um objeto JSON estrito.

REGRAS:
1. Retorne APENAS o JSON no formato: {"dados": [ { "identificador": "...", "nome": "...", "salario_base": 0.0, ... } ]}
2. O campo "identificador" deve conter a Matrícula ou o CPF.
3. Converta valores monetários para números (ex: "1.234,56" -> 1234.56). Use null se não encontrar.
4. NUNCA invente valores. Se não existir no texto, use null.
5. Campos: identificador, nome, salario_base, salario_bruto, salario_liquido, horas_extras, adicional_noturno, gratificacao_incentivo, vencimento_liquido.

TEXTO DO PDF:
${data.texto}`;

    const registrarMetrica = async (id: string, ok: boolean, ms: number, status: number, erro: string | null) => {
      try {
        await (context.supabase as any).rpc("piso_ia_provedor_metrica", {
          _id: id, _ok: ok, _ms: ms, _status: status, _erro: erro, _confianca: null, _pdfs: ok ? 1 : 0
        });
      } catch (e) { /* ignore telemetry errors */ }
    };

    let textoFinal = "";
    let provedorUsado = "";
    const falhas: any[] = [];

    // 3. Execução com failover
    for (const cfg of provedoresParaUsar) {
      const provider = criarProvider(cfg as any);
      const inicio = Date.now();
      try {
        const r = await provider.processarPDF({ 
          prompt, 
          instrucao: "Extraia os salários do texto fornecido conforme as regras do sistema.", 
          paginas: [] // Usando apenas texto bruto extraído anteriormente
        });
        textoFinal = r.texto;
        provedorUsado = `${cfg.nome} (${cfg.modelo})`;
        await registrarMetrica(cfg.id, true, r.ms, 200, null);
        break;
      } catch (e: any) {
        const status = e instanceof ProviderError ? e.status : 0;
        const msg = e.message || String(e);
        falhas.push({ provedor: cfg.nome, status, erro: msg });
        await registrarMetrica(cfg.id, false, Date.now() - inicio, status, msg);
      }
    }

    if (!textoFinal) {
      const resumo = falhas.map(f => `${f.provedor} [${f.status}]`).join(" > ");
      throw new Error(`Falha na extração IA: ${resumo}`);
    }

    try {
      const content = JSON.parse(textoFinal.match(/\{[\s\S]*\}/)?.[0] || textoFinal);
      return {
        dados: (content.dados || []) as SalarioExtraido[],
        modelo: provedorUsado,
        tentativas_falhas: falhas
      };
    } catch (error) {
      throw new Error("A IA retornou um formato de dados inválido. Tente outro provedor.");
    }
  });

/**
 * Função para salvar os salários confirmados.
 */
export const salvarSalariosImportados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.array(z.object({
      id: z.string().uuid(),
      salario_base: z.number().nullable(),
      salario_bruto: z.number().nullable(),
      salario_liquido: z.number().nullable(),
      horas_extras: z.number().nullable(),
      adicional_noturno: z.number().nullable(),
      gratificacao_incentivo: z.number().nullable(),
      vencimento_liquido: z.number().nullable(),
    })).parse(d)
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    
    // Processamento em lote (RPC ou loop dependendo da volumetria, aqui usaremos loop simples por segurança RLS)
    const resultados = [];
    for (const item of data) {
      const { error } = await supabase
        .from("profissionais")
        .update({
          salario_base: item.salario_base,
          salario_bruto: item.salario_bruto,
          salario_liquido: item.salario_liquido,
          horas_extras: item.horas_extras,
          adicional_noturno: item.adicional_noturno,
          gratificacao_incentivo: item.gratificacao_incentivo,
          vencimento_liquido: item.vencimento_liquido,
        })
        .eq("id", item.id);
      
      resultados.push({ id: item.id, success: !error });
    }

    return { 
      total: data.length, 
      sucesso: resultados.filter(r => r.success).length 
    };
  });
