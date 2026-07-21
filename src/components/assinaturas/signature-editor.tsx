import { useCallback, useEffect, useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  RotateCcw,
  ZoomIn,
} from "lucide-react";

/**
 * Editor visual de posicionamento de assinatura.
 *
 * Trabalha em coordenadas de referência 400x560 px (A4 retrato),
 * que são convertidas proporcionalmente para o PDF final.
 */

export const REF_W = 400;
export const REF_H = 560;

export type SignaturePosition = {
  posicao_x: number | null; // px na referência (canto sup. esquerdo da imagem)
  posicao_y: number | null;
  tamanho_percentual: number; // 50..150 (default 80)
  alinhamento: "esquerda" | "centro" | "direita";
  mostrar_nome: boolean;
  mostrar_cargo: boolean;
};

export const DEFAULT_POSITION: SignaturePosition = {
  posicao_x: null,
  posicao_y: null,
  tamanho_percentual: 80,
  alinhamento: "direita",
  mostrar_nome: true,
  mostrar_cargo: true,
};

const BASE_SIG_W = 120; // largura base da assinatura em px na referência
const BASE_SIG_H = 48;
const GRID = 10; // grid magnético

export function SignatureEditor({
  imageUrl,
  value,
  onChange,
  titularNome,
  titularCargo,
  headerLine1 = "PREFEITURA MUNICIPAL",
  headerLine2 = "Secretaria Municipal de Saúde",
}: {
  imageUrl: string | null;
  value: SignaturePosition;
  onChange: (v: SignaturePosition) => void;
  titularNome?: string;
  titularCargo?: string;
  headerLine1?: string;
  headerLine2?: string;
}) {
  const [zoom, setZoom] = useState<0.5 | 0.75 | 1>(0.75);
  const [dragging, setDragging] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const sigW = Math.round(BASE_SIG_W * (value.tamanho_percentual / 100));
  const sigH = Math.round(BASE_SIG_H * (value.tamanho_percentual / 100));

  // posição efetiva (px na referência) — usa alinhamento se x/y não definidos
  const effX =
    value.posicao_x ??
    (value.alinhamento === "esquerda"
      ? 40
      : value.alinhamento === "centro"
        ? Math.round((REF_W - sigW) / 2)
        : REF_W - sigW - 40);
  const effY = value.posicao_y ?? REF_H - sigH - 90;

  const patch = useCallback(
    (p: Partial<SignaturePosition>) => onChange({ ...value, ...p }),
    [value, onChange],
  );

  const snap = (v: number) => Math.round(v / GRID) * GRID;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imageUrl) return;
    setDragging(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const scale = rect.width / REF_W;
    const relX = (e.clientX - rect.left) / scale - sigW / 2;
    const relY = (e.clientY - rect.top) / scale - sigH / 2;
    const x = Math.max(0, Math.min(REF_W - sigW, snap(relX)));
    const y = Math.max(0, Math.min(REF_H - sigH, snap(relY)));
    patch({ posicao_x: x, posicao_y: y });
  };
  const onPointerUp = () => setDragging(false);

  useEffect(() => {
    // Clampa quando o tamanho muda
    if (value.posicao_x !== null || value.posicao_y !== null) {
      const nx = Math.max(0, Math.min(REF_W - sigW, value.posicao_x ?? 0));
      const ny = Math.max(0, Math.min(REF_H - sigH, value.posicao_y ?? 0));
      if (nx !== value.posicao_x || ny !== value.posicao_y) {
        patch({ posicao_x: nx, posicao_y: ny });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.tamanho_percentual]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Pré-visualização em documento oficial</Label>
        <div className="flex items-center gap-1 text-xs">
          <ZoomIn className="h-3 w-3 text-muted-foreground" />
          {[0.5, 0.75, 1].map((z) => (
            <Button
              key={z}
              type="button"
              size="sm"
              variant={zoom === z ? "default" : "outline"}
              className="h-6 px-2 text-[11px]"
              onClick={() => setZoom(z as 0.5 | 0.75 | 1)}
            >
              {z * 100}%
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-auto border rounded-lg bg-muted/40 p-3 flex justify-center">
        <div
          ref={areaRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative bg-white shadow-sm border select-none"
          style={{
            width: REF_W * zoom,
            height: REF_H * zoom,
            backgroundImage:
              "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
            backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
          }}
        >
          {/* Cabeçalho fictício */}
          <div
            className="absolute left-0 right-0 top-0 text-center border-b"
            style={{ padding: 8 * zoom }}
          >
            <div
              className="font-bold text-slate-700"
              style={{ fontSize: 11 * zoom }}
            >
              {headerLine1}
            </div>
            <div className="text-slate-500" style={{ fontSize: 9 * zoom }}>
              {headerLine2}
            </div>
          </div>
          {/* Texto simulado */}
          <div
            className="absolute left-0 right-0 space-y-1"
            style={{ top: 60 * zoom, padding: `0 ${20 * zoom}px` }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-200/60 rounded"
                style={{
                  height: 4 * zoom,
                  width: `${70 + ((i * 7) % 25)}%`,
                }}
              />
            ))}
          </div>

          {/* Guias de alinhamento quando arrastando */}
          {dragging && (
            <>
              <div
                className="absolute top-0 bottom-0 border-l border-dashed border-primary/50"
                style={{ left: (effX + sigW / 2) * zoom }}
              />
              <div
                className="absolute left-0 right-0 border-t border-dashed border-primary/50"
                style={{ top: (effY + sigH / 2) * zoom }}
              />
            </>
          )}

          {/* Bloco da assinatura */}
          <div
            onPointerDown={onPointerDown}
            className="absolute cursor-move flex flex-col items-center"
            style={{
              left: effX * zoom,
              top: effY * zoom,
              width: sigW * zoom,
              touchAction: "none",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Assinatura"
                draggable={false}
                className="pointer-events-none"
                style={{
                  width: sigW * zoom,
                  height: sigH * zoom,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                className="bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400"
                style={{ width: sigW * zoom, height: sigH * zoom }}
              >
                assinatura
              </div>
            )}
            <div
              className="border-t border-slate-700 mt-0.5"
              style={{ width: sigW * zoom }}
            />
            {value.mostrar_nome && titularNome && (
              <div
                className="text-center font-semibold text-slate-800 leading-tight"
                style={{ fontSize: 8 * zoom, marginTop: 2 * zoom }}
              >
                {titularNome}
              </div>
            )}
            {value.mostrar_cargo && titularCargo && (
              <div
                className="text-center text-slate-600 leading-tight"
                style={{ fontSize: 7 * zoom }}
              >
                {titularCargo}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Posição X (horizontal)</Label>
              <span className="text-xs text-muted-foreground">{effX}px</span>
            </div>
            <Slider
              value={[effX]}
              min={0}
              max={REF_W - sigW}
              step={GRID}
              onValueChange={([x]) => patch({ posicao_x: x })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Posição Y (vertical)</Label>
              <span className="text-xs text-muted-foreground">{effY}px</span>
            </div>
            <Slider
              value={[effY]}
              min={0}
              max={REF_H - sigH}
              step={GRID}
              onValueChange={([y]) => patch({ posicao_y: y })}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Tamanho</Label>
              <span className="text-xs text-muted-foreground">
                {value.tamanho_percentual}%
              </span>
            </div>
            <Slider
              value={[value.tamanho_percentual]}
              min={50}
              max={150}
              step={5}
              onValueChange={([t]) => patch({ tamanho_percentual: t })}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">Alinhamento rápido</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={value.alinhamento === "esquerda" ? "default" : "outline"}
                className="flex-1"
                onClick={() =>
                  patch({
                    alinhamento: "esquerda",
                    posicao_x: null,
                    posicao_y: null,
                  })
                }
              >
                <AlignLeft className="h-3 w-3 mr-1" /> Esq.
              </Button>
              <Button
                type="button"
                size="sm"
                variant={value.alinhamento === "centro" ? "default" : "outline"}
                className="flex-1"
                onClick={() =>
                  patch({
                    alinhamento: "centro",
                    posicao_x: null,
                    posicao_y: null,
                  })
                }
              >
                <AlignCenter className="h-3 w-3 mr-1" /> Centro
              </Button>
              <Button
                type="button"
                size="sm"
                variant={value.alinhamento === "direita" ? "default" : "outline"}
                className="flex-1"
                onClick={() =>
                  patch({
                    alinhamento: "direita",
                    posicao_x: null,
                    posicao_y: null,
                  })
                }
              >
                <AlignRight className="h-3 w-3 mr-1" /> Dir.
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded border p-2">
            <Label className="text-xs">Mostrar nome</Label>
            <Switch
              checked={value.mostrar_nome}
              onCheckedChange={(v) => patch({ mostrar_nome: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded border p-2">
            <Label className="text-xs">Mostrar cargo</Label>
            <Switch
              checked={value.mostrar_cargo}
              onCheckedChange={(v) => patch({ mostrar_cargo: v })}
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => onChange(DEFAULT_POSITION)}
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
          </Button>
        </div>
      </div>
    </div>
  );
}