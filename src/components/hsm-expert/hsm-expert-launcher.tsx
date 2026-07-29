import { lazy, Suspense, useRef, useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDraggable } from "@/hooks/use-draggable";

const Painel = lazy(() => import("./hsm-expert-panel"));

/**
 * Botão flutuante do HSM Expert. O painel só entra no bundle quando o usuário
 * abre a IA (lazy loading), preservando o desempenho inicial do ERP.
 * O botão pode ser arrastado para qualquer canto da tela.
 */
export function HsmExpertLauncher() {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const moveu = useRef(false);

  const drag = useDraggable({
    chave: "hsm-expert-botao-pos",
    ignorarControles: false,
    inicial: (tamanho, janela) => ({
      x: janela.largura - tamanho.largura - 24,
      y: janela.altura - tamanho.altura - 24,
    }),
  });

  return (
    <>
      <div
        ref={drag.elementoRef}
        style={drag.style}
        {...drag.handleProps}
        onPointerDown={(e) => {
          moveu.current = false;
          drag.handleProps.onPointerDown(e);
        }}
        onPointerMove={(e) => {
          if (drag.arrastando) moveu.current = true;
          drag.handleProps.onPointerMove(e);
        }}
        className={cn(
          "fixed z-40 touch-none",
          drag.arrastando ? "cursor-grabbing" : "cursor-grab",
          aberto && "pointer-events-none opacity-0",
        )}
      >
        <button
          type="button"
          aria-label="Abrir HSM Expert"
          title="Arraste para reposicionar"
          onClick={() => {
            if (moveu.current) return; // arrastar não deve abrir o painel
            setMontado(true);
            setAberto(true);
          }}
          className={cn(
            "flex items-center gap-2 rounded-full border border-primary/20 bg-primary px-4 py-3 text-primary-foreground shadow-lg transition",
            "hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Bot className="size-5" />
          <span className="hidden text-sm font-medium sm:inline">HSM Expert</span>
        </button>
      </div>

      {montado ? (
        <Suspense fallback={null}>
          <Painel aberto={aberto} onFechar={() => setAberto(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
