import { useNetworkStatus } from "@/hooks/use-network-status";
import { AlertCircle, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function NetworkBanner() {
  const { isOnline } = useNetworkStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
    } else {
      // Pequeno delay para desaparecer suavemente após reconectar
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!visible) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium transition-all duration-500 animate-in slide-in-from-top ${
        isOnline
          ? "bg-emerald-600 text-white"
          : "bg-destructive text-destructive-foreground shadow-lg"
      }`}
    >
      {isOnline ? (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Conexão restabelecida. O sistema está online.
        </>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center gap-2">
            <WifiOff className="h-4 w-4" />
            <span>⚠️ Você está offline. Exibindo dados em cache. Escrita bloqueada.</span>
          </div>
          <button 
            onClick={async () => {
              const { gerarRelatorioOffline } = await import("@/lib/offline-guard");
              alert(gerarRelatorioOffline());
            }}
            className="text-xs underline decoration-dotted underline-offset-4 hover:text-white transition-colors"
          >
            Ver Relatório Offline
          </button>
        </div>
      )}
    </div>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
