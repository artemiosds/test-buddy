/**
 * Onda D — Modelos Salvos, Favoritos e Histórico.
 * Persistência 100% local (localStorage). Nenhum banco/API/permissão alterados.
 */
import type { BlockConfig } from "./tipos";

const KEY_MODELOS = "rel-int:modelos:v1";
const KEY_HISTORICO = "rel-int:historico:v1";
const MAX_HISTORICO = 30;

export type TipoRelatorioSalvo =
  | "executivo"
  | "tecnico"
  | "administrativo"
  | "rh"
  | "auditoria"
  | "personalizado";

export type ModeloSalvo = {
  id: string;
  nome: string;
  descricao?: string;
  favorito: boolean;
  tipo: TipoRelatorioSalvo;
  blocks: BlockConfig[];
  textFilter: string;
  formato: string;
  criadoEm: string;
  atualizadoEm: string;
};

export type EntradaHistorico = {
  id: string;
  nome: string;
  tipo: TipoRelatorioSalvo;
  formato: string;
  qtdBlocos: number;
  geradoEm: string;
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function safeWrite(key: string, val: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota */
  }
}

export function listarModelos(): ModeloSalvo[] {
  const arr = safeRead<ModeloSalvo[]>(KEY_MODELOS, []);
  return arr.slice().sort((a, b) => {
    if (a.favorito !== b.favorito) return a.favorito ? -1 : 1;
    return (b.atualizadoEm || "").localeCompare(a.atualizadoEm || "");
  });
}

export function salvarModelo(
  input: Omit<ModeloSalvo, "id" | "criadoEm" | "atualizadoEm" | "favorito"> & {
    id?: string;
    favorito?: boolean;
  },
): ModeloSalvo {
  const now = new Date().toISOString();
  const modelos = safeRead<ModeloSalvo[]>(KEY_MODELOS, []);
  if (input.id) {
    const idx = modelos.findIndex((m) => m.id === input.id);
    if (idx >= 0) {
      const atualizado: ModeloSalvo = {
        ...modelos[idx],
        ...input,
        id: modelos[idx].id,
        favorito: input.favorito ?? modelos[idx].favorito,
        atualizadoEm: now,
      };
      modelos[idx] = atualizado;
      safeWrite(KEY_MODELOS, modelos);
      return atualizado;
    }
  }
  const novo: ModeloSalvo = {
    id: `mod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nome: input.nome,
    descricao: input.descricao,
    favorito: input.favorito ?? false,
    tipo: input.tipo,
    blocks: input.blocks,
    textFilter: input.textFilter,
    formato: input.formato,
    criadoEm: now,
    atualizadoEm: now,
  };
  modelos.push(novo);
  safeWrite(KEY_MODELOS, modelos);
  return novo;
}

export function excluirModelo(id: string) {
  const modelos = safeRead<ModeloSalvo[]>(KEY_MODELOS, []).filter((m) => m.id !== id);
  safeWrite(KEY_MODELOS, modelos);
}

export function toggleFavorito(id: string) {
  const modelos = safeRead<ModeloSalvo[]>(KEY_MODELOS, []);
  const idx = modelos.findIndex((m) => m.id === id);
  if (idx < 0) return;
  modelos[idx] = {
    ...modelos[idx],
    favorito: !modelos[idx].favorito,
    atualizadoEm: new Date().toISOString(),
  };
  safeWrite(KEY_MODELOS, modelos);
}

export function exportarModeloJson(m: ModeloSalvo): string {
  return JSON.stringify(m, null, 2);
}
export function importarModeloJson(raw: string): ModeloSalvo {
  const parsed = JSON.parse(raw) as ModeloSalvo;
  if (!parsed || !Array.isArray(parsed.blocks)) throw new Error("Arquivo inválido");
  return salvarModelo({
    nome: parsed.nome + " (importado)",
    descricao: parsed.descricao,
    tipo: parsed.tipo,
    blocks: parsed.blocks,
    textFilter: parsed.textFilter ?? "",
    formato: parsed.formato ?? "pdf",
    favorito: false,
  });
}

/* ---------- Histórico ---------- */

export function listarHistorico(): EntradaHistorico[] {
  return safeRead<EntradaHistorico[]>(KEY_HISTORICO, [])
    .slice()
    .sort((a, b) => (b.geradoEm || "").localeCompare(a.geradoEm || ""));
}
export function registrarHistorico(e: Omit<EntradaHistorico, "id" | "geradoEm">) {
  const arr = safeRead<EntradaHistorico[]>(KEY_HISTORICO, []);
  arr.unshift({
    ...e,
    id: `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    geradoEm: new Date().toISOString(),
  });
  safeWrite(KEY_HISTORICO, arr.slice(0, MAX_HISTORICO));
}
export function limparHistorico() {
  safeWrite(KEY_HISTORICO, []);
}
