/**
 * Grade profissional (estilo ERP hospitalar) para as telas de Folha /
 * Piso. Este módulo trata SOMENTE da experiência de interface — não
 * altera server functions, cálculos, permissões nem regras de negócio.
 *
 * O consumidor mantém a mesma máquina de estado local (Record<pid, LinhaState>)
 * e continua chamando `salvar*`/`enviar*` como antes; a grade apenas oferece
 * células com digitação rápida, navegação estilo Excel, colagem em bloco,
 * congelamento de colunas, cabeçalho fixo, totais no rodapé, alertas por
 * situação funcional e barra de inconsistências.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useRef, useState, type ReactNode,
} from "react";
import { AlertTriangle, ClipboardList, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  ALERTA_LABEL, derivarAlertas, derivarSituacao,
  type ProfConferencia,
} from "@/lib/situacao-funcional";

/* -----------------------------------------------------------------------
 * Contexto de teclado / colagem — registra células e move o foco.
 * ----------------------------------------------------------------------- */
type CellId = string;

type Ctx = {
  register: (rowId: string, colKey: string, el: HTMLInputElement | null) => void;
  focusCell: (rowId: string, colKey: string) => void;
  onCellKeyDown: (
    rowId: string, colKey: string, e: React.KeyboardEvent<HTMLInputElement>,
  ) => void;
  onCellPaste: (
    rowId: string, colKey: string, e: React.ClipboardEvent<HTMLInputElement>,
  ) => void;
  setActiveRow: (rowId: string | null) => void;
  bindTbody: (el: HTMLTableSectionElement | null) => void;
};

const ErpCtx = createContext<Ctx | null>(null);
function useErp(): Ctx {
  const v = useContext(ErpCtx);
  if (!v) throw new Error("<ErpGridProvider> ausente.");
  return v;
}

export type ErpGridProviderProps = {
  /** ordem visual dos ids das linhas (para navegação vertical). */
  rowIds: string[];
  /** ordem visual das colunas editáveis (para navegação horizontal e paste). */
  colKeys: string[];
  /** aplicação de colagem em bloco. Recebe o rowId/colKey de origem e uma matriz
   *  linhas×colunas (TSV do clipboard). Ignora colunas readonly no consumidor. */
  onPaste: (rowId: string, colKey: string, matrix: string[][]) => void;
  children: ReactNode;
};

export function ErpGridProvider({
  rowIds, colKeys, onPaste, children,
}: ErpGridProviderProps) {
  const cells = useRef(new Map<CellId, HTMLInputElement>());
  const rowIdsRef = useRef(rowIds);
  const colKeysRef = useRef(colKeys);
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);

  useEffect(() => { rowIdsRef.current = rowIds; }, [rowIds]);
  useEffect(() => { colKeysRef.current = colKeys; }, [colKeys]);

  const register = useCallback(
    (rowId: string, colKey: string, el: HTMLInputElement | null) => {
      const id = `${rowId}::${colKey}`;
      if (el) cells.current.set(id, el);
      else cells.current.delete(id);
    }, []);

  const focusCell = useCallback((rowId: string, colKey: string) => {
    const el = cells.current.get(`${rowId}::${colKey}`);
    if (!el) return;
    el.focus();
    try { el.select(); } catch { /* noop */ }
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, []);

  const move = useCallback((rowId: string, colKey: string, dr: number, dc: number) => {
    const rs = rowIdsRef.current; const cs = colKeysRef.current;
    const r = rs.indexOf(rowId); const c = cs.indexOf(colKey);
    if (r < 0 || c < 0) return;
    let nr = r + dr; let nc = c + dc;
    if (nc >= cs.length) { nc = 0; nr += 1; }
    if (nc < 0) { nc = cs.length - 1; nr -= 1; }
    if (nr < 0 || nr >= rs.length) return;
    focusCell(rs[nr], cs[nc]);
  }, [focusCell]);

  const onCellKeyDown = useCallback((
    rowId: string, colKey: string, e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.altKey || e.metaKey) return;
    if (e.key === "Enter") { e.preventDefault(); move(rowId, colKey, 1, 0); return; }
    if (e.key === "Tab")   { e.preventDefault(); move(rowId, colKey, 0, e.shiftKey ? -1 : 1); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); move(rowId, colKey, -1, 0); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(rowId, colKey, 1, 0); return; }
    if (e.key === "ArrowRight") {
      const el = e.currentTarget;
      if (el.selectionStart === el.value.length && el.selectionEnd === el.value.length) {
        e.preventDefault(); move(rowId, colKey, 0, 1);
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      const el = e.currentTarget;
      if (el.selectionStart === 0 && el.selectionEnd === 0) {
        e.preventDefault(); move(rowId, colKey, 0, -1);
      }
    }
  }, [move]);

  const onCellPaste = useCallback((
    rowId: string, colKey: string, e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    // Uma única célula copiada: mantém o comportamento nativo do input.
    if (!text.includes("\t") && !text.includes("\n")) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n");
    // Descarta a última linha se vier vazia (final com \n).
    while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    const matrix = lines.map((row) => row.split("\t"));
    onPaste(rowId, colKey, matrix);
  }, [onPaste]);

  const setActiveRow = useCallback((rowId: string | null) => {
    const tb = tbodyRef.current;
    if (!tb) return;
    // Marca via atributo — evita re-render de todas as linhas.
    const prev = tb.querySelector<HTMLTableRowElement>('tr[data-active="true"]');
    if (prev && prev.dataset.rowId !== rowId) prev.removeAttribute("data-active");
    if (rowId) {
      const next = tb.querySelector<HTMLTableRowElement>(`tr[data-row-id="${cssEsc(rowId)}"]`);
      if (next) next.setAttribute("data-active", "true");
      tb.dataset.activeRow = rowId;
    } else {
      delete tb.dataset.activeRow;
    }
  }, []);

  const bindTbody = useCallback((el: HTMLTableSectionElement | null) => {
    tbodyRef.current = el;
  }, []);

  const value = useMemo<Ctx>(
    () => ({ register, focusCell, onCellKeyDown, onCellPaste, setActiveRow, bindTbody }),
    [register, focusCell, onCellKeyDown, onCellPaste, setActiveRow, bindTbody],
  );

  return <ErpCtx.Provider value={value}>{children}</ErpCtx.Provider>;
}

/** Escape mínimo para query selector CSS.escape (fallback antigo). */
function cssEsc(v: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(v);
  return v.replace(/["\\\n]/g, "\\$&");
}

/* -----------------------------------------------------------------------
 * NumberCell — input rápido para lançamentos.
 * ----------------------------------------------------------------------- */
export type NumberCellProps = {
  rowId: string;
  colKey: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
  /** Retorna mensagem se o valor estiver fora do esperado; não bloqueia edição. */
  validate?: (v: number) => string | null;
  className?: string;
  title?: string;
};

export function NumberCell({
  rowId, colKey, value, onChange, disabled,
  min = 0, max, step, decimals, validate, className, title,
}: NumberCellProps) {
  const ctx = useErp();
  const ref = useRef<HTMLInputElement | null>(null);
  const [local, setLocal] = useState<string>(fmtNum(value, decimals));

  useEffect(() => {
    setLocal(fmtNum(value, decimals));
  }, [value, decimals]);

  useEffect(() => {
    ctx.register(rowId, colKey, ref.current);
    return () => ctx.register(rowId, colKey, null);
  }, [ctx, rowId, colKey]);

  const invalid = validate ? validate(value) : null;

  return (
    <input
      ref={ref}
      type="number"
      inputMode={decimals ? "decimal" : "numeric"}
      pattern={decimals ? "[0-9.,]*" : "[0-9]*"}
      className={cn("erp-cell-input", className)}
      value={local}
      min={min}
      max={max}
      step={step ?? (decimals ? "0.01" : "1")}
      disabled={disabled}
      title={invalid ?? title}
      data-invalid={invalid ? "true" : undefined}
      onFocus={(e) => {
        e.currentTarget.select();
        ctx.setActiveRow(rowId);
      }}
      onBlur={() => {
        ctx.setActiveRow(null);
        // normaliza no blur (evita "abc")
        const n = parseNum(local);
        if (n !== value) onChange(n);
        setLocal(fmtNum(n, decimals));
      }}
      onChange={(e) => {
        const s = e.target.value;
        setLocal(s);
        const n = parseNum(s);
        onChange(n);
      }}
      onKeyDown={(e) => ctx.onCellKeyDown(rowId, colKey, e)}
      onPaste={(e) => ctx.onCellPaste(rowId, colKey, e)}
    />
  );
}

function parseNum(s: string): number {
  if (!s) return 0;
  const t = s.trim().replace(/\./g, "").replace(",", ".");
  const n = Number(t.includes(".") || t.includes("-") ? t : s);
  return Number.isFinite(n) && n >= 0 ? n : Number.isFinite(n) ? n : 0;
}
function fmtNum(n: number, decimals?: number): string {
  if (decimals && decimals > 0) return (n ?? 0).toFixed(decimals);
  return String(n ?? 0);
}

/* -----------------------------------------------------------------------
 * TextCell — observação em uma linha, sem borda pesada.
 * ----------------------------------------------------------------------- */
export function TextCell({
  rowId, value, onChange, disabled, placeholder,
}: {
  rowId: string; value: string;
  onChange: (v: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const ctx = useErp();
  return (
    <input
      type="text"
      className="erp-cell-textarea"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => ctx.setActiveRow(rowId)}
      onBlur={() => ctx.setActiveRow(null)}
      disabled={disabled}
      placeholder={placeholder}
    />
  );
}

/* -----------------------------------------------------------------------
 * ErpTbody — encapsula o bind do <tbody> no contexto para permitir
 * o destaque da linha em edição via atributo `data-active-row`.
 * ----------------------------------------------------------------------- */
export function ErpTbody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  const ctx = useErp();
  return <tbody ref={ctx.bindTbody} {...props} />;
}

/* -----------------------------------------------------------------------
 * Helpers de colunas congeladas — calculam `left` acumulado
 * ----------------------------------------------------------------------- */
export type FrozenCol = { key: string; label: string; width: number };

export function frozenLeftMap(cols: FrozenCol[]): Record<string, number> {
  const out: Record<string, number> = {};
  let acc = 0;
  for (const c of cols) { out[c.key] = acc; acc += c.width; }
  return out;
}

/* -----------------------------------------------------------------------
 * KpiFolhaBar — painel superior de indicadores da competência.
 * ----------------------------------------------------------------------- */
export type KpiTotais = {
  total: number;
  ativos: number;
  ferias: number;
  licenca: number;
  afastados: number;
  pendencias: number;
  naoElegiveis: number;
  totalHE50: number;
  totalHE100: number;
  totalPlantoes: number;
  totalFaltas: number;
};

export function KpiFolhaBar({ k }: { k: KpiTotais }) {
  const nf = new Intl.NumberFormat("pt-BR");
  const item = (label: string, value: number, tone?: "ok" | "info" | "warn" | "danger") => (
    <div className="erp-kpi" data-tone={tone}>
      <span className="erp-kpi-label">{label}</span>
      <span className="erp-kpi-value">{nf.format(value)}</span>
    </div>
  );
  return (
    <div className="erp-kpi-bar">
      {item("Total", k.total)}
      {item("Ativos", k.ativos, "ok")}
      {item("Férias", k.ferias, "info")}
      {item("Licença", k.licenca, "warn")}
      {item("Afastados", k.afastados, "warn")}
      {item("Pendências", k.pendencias, "warn")}
      {item("Não elegíveis (Piso)", k.naoElegiveis, "danger")}
      {item("HE 50%", k.totalHE50, "info")}
      {item("HE 100%", k.totalHE100, "info")}
      {item("Plantões", k.totalPlantoes, "info")}
      {item("Faltas", k.totalFaltas, "danger")}
    </div>
  );
}

/* -----------------------------------------------------------------------
 * InconsistenciasPanel — botão + drawer com profissionais em alerta.
 * ----------------------------------------------------------------------- */
export function InconsistenciasPanel({
  rows, onGoto,
}: {
  rows: ProfConferencia[];
  onGoto?: (rowId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const itens = useMemo(
    () => rows
      .map((p) => ({ p, alertas: derivarAlertas(p) }))
      .filter((x) => x.alertas.length > 0)
      .sort((a, b) => b.alertas.length - a.alertas.length),
    [rows],
  );

  return (
    <>
      <Button
        type="button" variant="outline" size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        title="Inconsistências cadastrais desta folha"
      >
        <AlertTriangle className="h-4 w-4 text-warning" />
        Inconsistências
        <span className={cn(
          "ml-1 rounded-full px-2 text-xs font-semibold tabular-nums",
          itens.length === 0
            ? "bg-success-soft text-success-soft-foreground"
            : "bg-warning-soft text-warning-soft-foreground",
        )}>
          {itens.length}
        </span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[420px] sm:max-w-[440px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Inconsistências cadastrais
            </SheetTitle>
            <SheetDescription>
              Profissionais visíveis nesta folha com dados obrigatórios
              incompletos. Estes alertas não bloqueiam o lançamento — apenas
              indicam correções que devem ser feitas no cadastro.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2 overflow-auto pr-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
            {itens.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma inconsistência encontrada nas linhas visíveis. 🎉
              </p>
            )}
            {itens.map(({ p, alertas }) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onGoto?.(p.id);
                }}
                className="w-full text-left rounded-md border border-border bg-card px-3 py-2 hover:bg-muted/40 transition"
              >
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{p.nome ?? "—"}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {p.matricula ?? ""}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {alertas.map((a) => (
                    <span
                      key={a}
                      className="rounded-full bg-warning-soft text-warning-soft-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    >
                      {ALERTA_LABEL[a]}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/* -----------------------------------------------------------------------
 * Utilitário para calcular os totais da barra de KPIs a partir do
 * estado local `linhas` já usado pelas páginas da folha. Aceita nomes
 * de campos diferentes entre Efetivos e Contratados.
 * ----------------------------------------------------------------------- */
export function calcularTotais<T extends Record<string, unknown>>(
  entries: T[],
  map: { he50: keyof T; he100: keyof T; plantoes: keyof T; faltas: keyof T },
) {
  let he50 = 0, he100 = 0, plantoes = 0, faltas = 0;
  for (const l of entries) {
    he50     += num(l[map.he50]);
    he100    += num(l[map.he100]);
    plantoes += num(l[map.plantoes]);
    faltas   += num(l[map.faltas]);
  }
  return { he50, he100, plantoes, faltas };
}
function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* Re-exporta derivarSituacao para uso no consumidor. */
export { derivarSituacao };