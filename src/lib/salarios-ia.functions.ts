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
 * Utiliza o Lovable AI Gateway para extração estruturada.
 */
export const extrairSalariosPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        texto: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("Lovable AI Gateway não configurado (LOVABLE_API_KEY ausente).");
    }

    const prompt = `
Você é um especialista em processamento de documentos de folha de pagamento.
Abaixo está o texto extraído de um PDF que contém uma tabela de salários.
Extraia os dados de CADA profissional na tabela e retorne um objeto JSON estrito.

REGRAS:
1. Retorne APENAS o JSON no formato: {"dados": [ { "identificador": "...", "nome": "...", "salario_base": 0.0, ... } ]}
2. O campo "identificador" deve conter a Matrícula ou o CPF (o que estiver disponível).
3. Converta valores monetários para números (ex: "1.234,56" -> 1234.56). Use null se não encontrar.
4. Campos obrigatórios no objeto: identificador, nome, salario_base, salario_bruto, salario_liquido, horas_extras, adicional_noturno, gratificacao_incentivo, vencimento_liquido.
5. Se o texto estiver truncado ou ilegível em uma linha, tente o seu melhor ou use null.

TEXTO DO PDF:
${data.texto}
`;

    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": key,
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-luna", // Mantendo o padrão de alta capacidade já usado no projeto
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });

      if (!resp.ok) {
        throw new Error(`Erro na API de IA: ${resp.status}`);
      }

      const result = await resp.json();
      const content = JSON.parse(result.choices[0].message.content);
      
      return { 
        dados: (content.dados || []) as SalarioExtraido[],
        raw: result.choices[0].message.content 
      };
    } catch (error) {
      console.error("[extrairSalariosPDF]", error);
      throw new Error("Falha ao processar o PDF com IA. Verifique se o formato é suportado.");
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
