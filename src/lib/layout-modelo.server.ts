// =============================================================================
// APRENDIZADO POR MODELO DE REFERÊNCIA — camada de servidor (helpers).
//
// A IA lê os cabeçalhos, as amostras e as fórmulas de uma planilha modelo e
// gera um Layout de Importação completo, sem mapeamento manual. É aditivo:
// os layouts criados manualmente continuam funcionando sem qualquer mudança.
// =============================================================================

import { CATALOGO_CAMPOS, campoCatalogo } from "./layout-campos-catalogo";
import { normalizarTexto } from "./layout-engine";
import {
  CHAVE_CONFIG_FORMULAS,
  regrasParaCampos,
  serializarRegras,
  type RegraFormulaColuna,
} from "./layout-formulas";

export type CampoGerado = {
  campo_interno: string;
  label: string;
  coluna_padrao: string;
  aliases: string[];
  obrigatorio: boolean;
  condicional: boolean;
  ignorado: boolean;
  tipo_dado: string;
  pesos: Record<string, number>;
  ordem: number;
};

const OBRIGATORIOS = new Set(["cpf", "nome"]);

const compacto = (s: string) => normalizarTexto(s).replace(/\s+/g, "");

/** Mapeamento heurístico cabeçalho → campo do catálogo (fallback sem IA). */
export function mapearPorCatalogo(headers: string[]): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  const usados = new Set<string>();
  const termos = CATALOGO_CAMPOS.map((c) => ({
    key: c.key,
    termos: [c.key, c.label, ...c.aliases].map(compacto).filter(Boolean),
  }));

  const rodada = (modo: "exato" | "parcial") => {
    for (const h of headers) {
      if (out[h]) continue;
      const alvo = compacto(h);
      if (!alvo) continue;
      for (const c of termos) {
        if (usados.has(c.key)) continue;
        const bate =
          modo === "exato"
            ? c.termos.includes(alvo)
            : alvo.length >= 4 &&
              c.termos.some((t) => t.length >= 4 && (alvo.includes(t) || t.includes(alvo)));
        if (bate) {
          out[h] = c.key;
          usados.add(c.key);
          break;
        }
      }
    }
  };
  rodada("exato");
  rodada("parcial");
  for (const h of headers) if (!(h in out)) out[h] = null;
  return out;
}

/** Consulta a IA para mapear os cabeçalhos que a heurística não resolveu. */
export async function mapearComIA(
  headers: string[],
  amostra: string[][],
): Promise<{ mapa: Record<string, string>; erro: string | null }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { mapa: {}, erro: "IA não configurada." };
  if (headers.length === 0) return { mapa: {}, erro: null };

  const catalogo = CATALOGO_CAMPOS.map((c) => `${c.key} = ${c.label} (${c.grupo})`).join("\n");
  const exemplos = amostra
    .slice(0, 3)
    .map((l) => l.slice(0, 40).join(" | "))
    .join("\n");
  const prompt = [
    "Você configura layouts de importação de folha de pagamento de uma prefeitura.",
    "Mapeie cada cabeçalho da planilha para uma chave do catálogo de campos internos.",
    'Responda APENAS com JSON: {"mapa":[{"header":"...","campo":"chave_do_catalogo"}]}.',
    "Use somente chaves existentes no catálogo. Omita cabeçalhos sem correspondência clara.",
    "Nunca repita a mesma chave para dois cabeçalhos diferentes.",
    "",
    "CATÁLOGO:",
    catalogo,
    "",
    "CABEÇALHOS:",
    headers.join(" | "),
    "",
    "AMOSTRA DE LINHAS:",
    exemplos,
  ].join("\n");

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (resp.status === 429) return { mapa: {}, erro: "Limite de uso da IA atingido." };
    if (resp.status === 402) return { mapa: {}, erro: "Créditos de IA esgotados." };
    if (!resp.ok) return { mapa: {}, erro: `Falha na IA [${resp.status}].` };

    const json = (await resp.json()) as any;
    const texto: string = json?.choices?.[0]?.message?.content ?? "";
    const bruto = texto.slice(texto.indexOf("{"), texto.lastIndexOf("}") + 1);
    const parsed = JSON.parse(bruto || "{}");
    const validos = new Set(CATALOGO_CAMPOS.map((c) => c.key));
    const mapa: Record<string, string> = {};
    for (const item of Array.isArray(parsed?.mapa) ? parsed.mapa : []) {
      const h = typeof item?.header === "string" ? item.header : null;
      const campo = typeof item?.campo === "string" ? item.campo : null;
      if (!h || !campo || !validos.has(campo)) continue;
      if (Object.values(mapa).includes(campo)) continue;
      mapa[h] = campo;
    }
    return { mapa, erro: null };
  } catch (e) {
    return { mapa: {}, erro: e instanceof Error ? e.message : "Falha ao consultar a IA." };
  }
}

/** Monta os campos do layout a partir do mapeamento final. */
export function montarCampos(
  headers: string[],
  mapa: Record<string, string | null>,
): CampoGerado[] {
  const campos: CampoGerado[] = [];
  let ordem = 0;
  for (const h of headers) {
    const destino = mapa[h] ?? null;
    if (!destino) continue;
    const cat = campoCatalogo(destino);
    const aliases = Array.from(
      new Set([h, ...(cat?.aliases ?? [])].map((a) => String(a).trim()).filter(Boolean)),
    ).slice(0, 40);
    campos.push({
      campo_interno: destino,
      label: cat?.label ?? destino,
      coluna_padrao: h,
      aliases,
      obrigatorio: OBRIGATORIOS.has(destino),
      condicional: !OBRIGATORIOS.has(destino),
      ignorado: false,
      tipo_dado: cat?.tipo_dado ?? "texto",
      pesos: { [h]: 100 },
      ordem: ordem++,
    });
  }
  return campos;
}

/** Pistas de reconhecimento automático do modelo nos próximos meses. */
export function montarHints(nomeArquivo: string, headers: string[]) {
  const arquivo = Array.from(
    new Set(
      normalizarTexto(nomeArquivo.replace(/\.[a-z0-9]+$/i, ""))
        .split(" ")
        .filter((t) => t.length >= 3 && !/^\d+$/.test(t)),
    ),
  ).slice(0, 10);
  const header = headers
    .map((h) => String(h).trim())
    .filter((h) => h.length >= 3)
    .slice(0, 30);
  return { arquivo_hints: arquivo, header_hints: header };
}

export function gerarCodigo(nome: string): string {
  const base =
    normalizarTexto(nome)
      .replace(/\s+/g, "-")
      .slice(0, 40)
      .replace(/^-+|-+$/g, "") || "modelo";
  return `${base}-${Date.now().toString(36)}`.slice(0, 60);
}

/** Persiste layout + versão + campos + fórmulas aprendidas. */
export async function persistirLayoutGerado(
  supabase: any,
  userId: string,
  entrada: {
    codigo: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    modulo: string;
    arquivo_hints: string[];
    header_hints: string[];
    campos: CampoGerado[];
    formulasColuna: RegraFormulaColuna[];
    mapa: Record<string, string | null>;
    notas: string | null;
  },
) {
  const regras = regrasParaCampos(entrada.formulasColuna, entrada.mapa);

  const { data: layout, error } = await supabase
    .from("import_layouts")
    .insert({
      codigo: entrada.codigo,
      nome: entrada.nome,
      descricao: entrada.descricao,
      tipo: entrada.tipo,
      modulo: entrada.modulo,
      versao_atual: 1,
      criado_por: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: versao, error: e2 } = await supabase
    .from("import_layout_versoes")
    .insert({
      layout_id: layout.id,
      versao: 1,
      situacao: "ativa",
      notas: entrada.notas,
      arquivo_hints: entrada.arquivo_hints,
      header_hints: entrada.header_hints,
      config: { [CHAVE_CONFIG_FORMULAS]: serializarRegras(regras), origem: "modelo_ia" },
      criado_por: userId,
    })
    .select("id")
    .single();
  if (e2) throw new Error(e2.message);

  if (entrada.campos.length > 0) {
    const rows = entrada.campos.map((c, i) => ({
      versao_id: versao.id,
      campo_interno: c.campo_interno,
      label: c.label,
      coluna_padrao: c.coluna_padrao,
      aliases: c.aliases,
      obrigatorio: c.obrigatorio,
      condicional: c.condicional,
      ignorado: c.ignorado,
      tipo_dado: c.tipo_dado,
      pesos: c.pesos,
      ordem: c.ordem ?? i,
    }));
    const { error: e3 } = await supabase.from("import_layout_campos").insert(rows);
    if (e3) throw new Error(e3.message);
  }

  return { layout_id: layout.id as string, versao_id: versao.id as string, regras };
}
