import { useCallback, useEffect, useRef, useState } from "react";

export type Posicao = { x: number; y: number };

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), Math.max(min, max));
}

function ler(chave: string): Posicao | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(chave);
    if (!raw) return null;
    const p = JSON.parse(raw) as Posicao;
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    /* posição inválida é simplesmente ignorada */
  }
  return null;
}

/**
 * Arrasto livre de um elemento fixo na tela.
 *
 * - Usa Pointer Events (funciona com mouse, toque e caneta).
 * - Mantém o elemento sempre dentro da área visível, inclusive ao redimensionar.
 * - Persiste a última posição por `chave` no localStorage.
 */
export function useDraggable(opts: {
  chave: string;
  /** Posição inicial calculada a partir do tamanho do elemento e da janela. */
  inicial: (tamanho: { largura: number; altura: number }, janela: { largura: number; altura: number }) => Posicao;
  ativo?: boolean;
  /** Quando falso, o arrasto também começa em cima de botões/inputs. */
  ignorarControles?: boolean;
}) {
  const { chave, inicial, ativo = true, ignorarControles = true } = opts;
  const elementoRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Posicao | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const inicialRef = useRef(inicial);
  inicialRef.current = inicial;

  const limitar = useCallback((p: Posicao): Posicao => {
    const el = elementoRef.current;
    const largura = el?.offsetWidth ?? 0;
    const altura = el?.offsetHeight ?? 0;
    return {
      x: clamp(p.x, 8, window.innerWidth - largura - 8),
      y: clamp(p.y, 8, window.innerHeight - altura - 8),
    };
  }, []);

  // Posição inicial (salva ou calculada) assim que o elemento existe.
  useEffect(() => {
    if (!ativo) return;
    const el = elementoRef.current;
    if (!el) return;
    const salva = ler(chave);
    const base =
      salva ??
      inicialRef.current(
        { largura: el.offsetWidth, altura: el.offsetHeight },
        { largura: window.innerWidth, altura: window.innerHeight },
      );
    setPos(limitar(base));
  }, [ativo, chave, limitar]);

  // Mantém dentro da tela quando a janela muda de tamanho.
  useEffect(() => {
    if (!ativo) return;
    const onResize = () => setPos((p) => (p ? limitar(p) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ativo, limitar]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = elementoRef.current;
      if (!el || e.button === 2) return;
      const alvo = e.target as HTMLElement;
      // Não sequestra cliques em controles dentro da área de arrasto.
      if (alvo.closest("[data-no-drag]")) return;
      if (ignorarControles && alvo.closest("button, a, input, textarea, select")) return;
      const r = el.getBoundingClientRect();
      drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      setArrastando(true);
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [ignorarControles],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag.current) return;
      e.preventDefault();
      setPos(limitar({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
    },
    [limitar],
  );

  const encerrar = useCallback(() => {
    if (!drag.current) return;
    drag.current = null;
    setArrastando(false);
    setPos((p) => {
      if (p) {
        try {
          window.localStorage.setItem(chave, JSON.stringify(p));
        } catch {
          /* armazenamento indisponível não impede o uso */
        }
      }
      return p;
    });
  }, [chave]);

  const reposicionar = useCallback(() => {
    const el = elementoRef.current;
    if (!el) return;
    const base = inicialRef.current(
      { largura: el.offsetWidth, altura: el.offsetHeight },
      { largura: window.innerWidth, altura: window.innerHeight },
    );
    const p = limitar(base);
    setPos(p);
    try {
      window.localStorage.removeItem(chave);
    } catch {
      /* ignorado */
    }
  }, [chave, limitar]);

  return {
    elementoRef,
    pos,
    arrastando,
    reposicionar,
    /** Props do "punho" de arrasto (cabeçalho do painel, corpo do botão etc.). */
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: encerrar,
      onPointerCancel: encerrar,
    },
    /** Estilo do elemento posicionado livremente. */
    style: pos
      ? ({ left: pos.x, top: pos.y, right: "auto", bottom: "auto" } as React.CSSProperties)
      : ({ visibility: "hidden" } as React.CSSProperties),
  };
}
