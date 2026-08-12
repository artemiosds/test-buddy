import { useEffect, useState } from "react";
import { ShieldCheck, BadgeCheck } from "lucide-react";

export type SeloAssinaturaProps = {
  nome?: string | null;
  cargo?: string | null;
  matricula?: string | null;
  cpf?: string | null;
  orgao?: string | null;
  dataHora?: string | null;
  /** Código verificador / hash. Quando ausente mostra placeholder. */
  codigo?: string | null;
  /** URL de validação usada no QR Code (padrão: /validar/{codigo}). */
  validationUrl?: string | null;
  className?: string;
};

function useQrDataUrl(text: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    if (!text) {
      setUrl(null);
      return;
    }
    (async () => {
      try {
        const mod: any = await import("qrcode");
        const toDataURL = mod.toDataURL ?? mod.default?.toDataURL;
        const d = await toDataURL(text, { margin: 0, width: 220 });
        if (ativo) setUrl(d);
      } catch {
        if (ativo) setUrl(null);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [text]);
  return url;
}

function Linha({ label, valor }: { label: string; valor?: string | null }) {
  if (!valor) return null;
  return (
    <div className="flex gap-2 text-[13px] leading-relaxed">
      <span className="w-[86px] shrink-0 text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{valor}</span>
    </div>
  );
}

/**
 * Selo de assinatura eletrônica no padrão institucional (referência SEI/gov.br).
 * Duas colunas: dados do signatário + QR Code de validação.
 */
export function SeloAssinaturaInstitucional({
  nome,
  cargo,
  matricula,
  cpf,
  orgao,
  dataHora,
  codigo,
  validationUrl,
  className,
}: SeloAssinaturaProps) {
  const alvoQr =
    codigo
      ? (validationUrl ??
        (typeof window !== "undefined" ? `${window.location.origin}/validar/${codigo}` : codigo))
      : null;
  const qr = useQrDataUrl(alvoQr);

  return (
    <div
      className={`relative overflow-hidden rounded-md border-2 border-slate-800 bg-white ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-800 px-3 py-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-white" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
          Documento assinado eletronicamente
        </span>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rotate-[-18deg] select-none text-[42px] font-black uppercase tracking-tight text-slate-900/[0.04]">
          Autenticado
        </span>
      </div>

      <div className="relative grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1">
          <Linha label="Nome" valor={nome} />
          <Linha label="Cargo" valor={cargo} />
          <Linha label="Matrícula" valor={matricula} />
          <Linha label="CPF" valor={cpf} />
          <Linha label="Órgão" valor={orgao} />
          <Linha
            label="Data/Hora"
            valor={dataHora ? new Date(dataHora).toLocaleString("pt-BR") : null}
          />

          <div className="pt-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Código verificador
            </p>
            {codigo ? (
              <p className="mt-1 break-all font-mono text-[13px] font-semibold tracking-wider text-slate-900">
                {codigo}
              </p>
            ) : (
              <p className="mt-1 font-mono text-[11px] italic text-slate-400">
                [Gerado automaticamente no momento da assinatura]
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-2 sm:w-[112px]">
          <div className="flex h-[92px] w-[92px] items-center justify-center rounded border border-slate-300 bg-white p-1">
            {qr ? (
              <img src={qr} alt="QR Code de validação do documento" className="h-full w-full" />
            ) : (
              <span className="px-1 text-center text-[9px] leading-tight text-slate-400">
                QR gerado após a assinatura
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Autenticado
          </div>
        </div>
      </div>

      <div className="border-t border-slate-300 bg-slate-50 px-4 py-2">
        <p className="text-[10px] leading-snug text-slate-600">
          A autenticidade deste documento pode ser conferida informando o código verificador{" "}
          <span className="font-mono font-semibold text-slate-800">
            {codigo ?? "———"}
          </span>{" "}
          no sistema.
        </p>
      </div>
    </div>
  );
}
