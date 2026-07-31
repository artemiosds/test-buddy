// =============================================================================
// CAMPOS PERSONALIZADOS DE IMPORTAÇÃO (por modelo de folha)
//
// O motor de mapeamento trabalha com strings livres como destino, portanto
// qualquer chave criada aqui é aceita pelo pipeline (applyMap → resolveRows).
// Este módulo apenas guarda o catálogo criado pelo usuário para que ele volte
// a aparecer no seletor nas próximas importações do mesmo modelo.
// =============================================================================

export type TipoCampoCustom = "texto" | "valor";

export type CampoCustom = {
  /** Chave gravada no mapeamento — sempre com prefixo `extra_`. */
  key: string;
  label: string;
  tipo: TipoCampoCustom;
};

const PREFIXO = "extra_";

/** Converte um rótulo livre em chave estável: "GRAT.INCENTIVO" → extra_grat_incentivo. */
export function chaveDeCampo(label: string): string {
  const slug = String(label ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return PREFIXO + (slug || "campo");
}

/** Verdadeiro para chaves criadas pelo usuário. */
export function isCampoCustom(key: string | null | undefined): boolean {
  return typeof key === "string" && key.startsWith(PREFIXO);
}

function storageKey(modelo: string): string {
  return `piso:campos-custom:${modelo}`;
}

export function carregarCamposCustom(modelo: string): CampoCustom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(modelo));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (c): c is CampoCustom =>
        !!c &&
        typeof (c as CampoCustom).key === "string" &&
        typeof (c as CampoCustom).label === "string",
    );
  } catch {
    return [];
  }
}

export function salvarCamposCustom(modelo: string, campos: CampoCustom[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(modelo), JSON.stringify(campos));
  } catch {
    /* quota cheia: o campo continua válido nesta sessão */
  }
}

/** Insere/atualiza um campo no catálogo, sem duplicar chaves. */
export function upsertCampoCustom(campos: CampoCustom[], novo: CampoCustom): CampoCustom[] {
  const outros = campos.filter((c) => c.key !== novo.key);
  return [...outros, novo].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}
