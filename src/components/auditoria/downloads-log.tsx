/**
 * Log de Downloads e Extrações — quem baixou qual relatório, com quais filtros e quando.
 * Lê os registros de auditoria gravados por registrarDownload().
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Row = {
  id: number;
  ocorrido_em: string;
  usuario_email: string | null;
  ip: string | null;
  contexto: {
    acao?: string;
    relatorio?: string;
    formato?: string;
    hash?: string | null;
    registros?: number | null;
    filtros?: Record<string, unknown>;
  } | null;
};

export function DownloadsLog() {
  const [dias, setDias] = useState("30");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery<Row[]>({
    queryKey: ["auditoria-downloads", dias],
    queryFn: async () => {
      const desde = new Date();
      desde.setDate(desde.getDate() - Number(dias));
      const { data, error } = await supabase
        .from("audit_log")
        .select("id, ocorrido_em, usuario_email, ip, contexto")
        .gte("ocorrido_em", desde.toISOString())
        .in("tabela", ["_relatorio_download", "_client_action"])
        .order("ocorrido_em", { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as Row[]).filter((r) =>
        String(r.contexto?.acao ?? "").startsWith("export."),
      );
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (!busca.trim()) return true;
    const b = busca.toLowerCase();
    return (
      (r.usuario_email ?? "").toLowerCase().includes(b) ||
      (r.contexto?.relatorio ?? "").toLowerCase().includes(b)
    );
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          className="sm:col-span-2"
          placeholder="Buscar por usuário ou relatório..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Data/hora</th>
                <th className="px-3 py-2">Usuário</th>
                <th className="px-3 py-2">Relatório</th>
                <th className="px-3 py-2">Formato</th>
                <th className="px-3 py-2">Filtros</th>
                <th className="px-3 py-2">Hash</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Carregando...
                  </td>
                </tr>
              )}
              {!isLoading && !rows.length && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma extração registrada no período.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2">
                    {new Date(r.ocorrido_em).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-3 py-2">{r.usuario_email ?? "—"}</td>
                  <td className="px-3 py-2">{r.contexto?.relatorio ?? r.contexto?.acao ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="uppercase">
                      {r.contexto?.formato ?? "—"}
                    </Badge>
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">
                    {r.contexto?.filtros ? JSON.stringify(r.contexto.filtros) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.contexto?.hash ? `${r.contexto.hash.slice(0, 12)}...` : "—"}
                  </td>
                  <td className="px-3 py-2">{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
