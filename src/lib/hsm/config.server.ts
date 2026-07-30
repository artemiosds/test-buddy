import type { ToolDef } from "./tools.server";
import { HSM_CONFIG_PADRAO, HSM_PROMPT_PADRAO, type HsmConfigPublica, type JsonValue } from "./config";

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

function jsonSeguro(v: unknown): JsonValue {
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map(jsonSeguro);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, valor]) => [k, jsonSeguro(valor)]),
    );
  }
  return null;
}

function jsonObjectSeguro(v: unknown): Record<string, JsonValue> {
  const obj = asObject(v);
  return Object.fromEntries(Object.entries(obj).map(([k, valor]) => [k, jsonSeguro(valor)]));
}

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function normalizarHsmConfig(raw: unknown): HsmConfigPublica {
  const row = asObject(raw);
  const limites = asObject(row.limites);
  const cache = asObject(row.cache_config);
  const retencao = asObject(row.retencao_config);
  const observabilidade = asObject(row.observabilidade_config);
  const modo = String(row.modo_execucao ?? HSM_CONFIG_PADRAO.modo_execucao);

  return {
    ativo: row.ativo !== false,
    somente_leitura: row.somente_leitura === true || modo === "somente_leitura",
    prompt_sistema:
      typeof row.prompt_sistema === "string" && row.prompt_sistema.trim()
        ? row.prompt_sistema.trim()
        : HSM_PROMPT_PADRAO,
    modo_execucao:
      modo === "somente_leitura" || modo === "autonomo_controlado" ? modo : "assistido",
    ferramentas_habilitadas: asStringArray(row.ferramentas_habilitadas),
    agentes_habilitados: asStringArray(row.agentes_habilitados),
    limites: {
      mensagens_por_minuto: num(
        limites.mensagens_por_minuto,
        HSM_CONFIG_PADRAO.limites.mensagens_por_minuto,
        1,
        120,
      ),
      mensagens_por_dia: num(
        limites.mensagens_por_dia,
        HSM_CONFIG_PADRAO.limites.mensagens_por_dia,
        10,
        5000,
      ),
      ferramentas_por_mensagem: num(
        limites.ferramentas_por_mensagem,
        HSM_CONFIG_PADRAO.limites.ferramentas_por_mensagem,
        1,
        10,
      ),
      tempo_maximo_ms: num(
        limites.tempo_maximo_ms,
        HSM_CONFIG_PADRAO.limites.tempo_maximo_ms,
        10000,
        600000,
      ),
    },
    cache_config: {
      habilitado: cache.habilitado !== false,
      ttl_segundos: num(cache.ttl_segundos, HSM_CONFIG_PADRAO.cache_config.ttl_segundos, 30, 86400),
    },
    retencao_config: {
      mensagens_dias: num(
        retencao.mensagens_dias,
        HSM_CONFIG_PADRAO.retencao_config.mensagens_dias,
        1,
        3650,
      ),
      auditoria_dias: num(
        retencao.auditoria_dias,
        HSM_CONFIG_PADRAO.retencao_config.auditoria_dias,
        30,
        3650,
      ),
    },
    observabilidade_config: {
      registrar_erros: observabilidade.registrar_erros !== false,
      registrar_tentativas: observabilidade.registrar_tentativas !== false,
      registrar_ferramentas: observabilidade.registrar_ferramentas !== false,
    },
    metadata: jsonObjectSeguro(row.metadata),
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function carregarHsmConfig(supabase: RpcClient): Promise<HsmConfigPublica> {
  const { data, error } = await supabase.rpc("hsm_config_ler");
  if (error) throw new Error(error.message);
  return normalizarHsmConfig(data);
}

export function filtrarFerramentasPorConfig(ferramentas: ToolDef[], config: HsmConfigPublica): ToolDef[] {
  const habilitadas = new Set(config.ferramentas_habilitadas);
  return ferramentas.filter((f) => {
    if (habilitadas.size > 0 && !habilitadas.has(f.nome)) return false;
    if ((config.somente_leitura || config.modo_execucao === "somente_leitura") && f.mutacao) return false;
    return true;
  });
}
