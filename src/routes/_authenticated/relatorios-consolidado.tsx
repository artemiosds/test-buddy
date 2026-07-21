import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { auditClient, AUDIT_ACOES } from "@/lib/audit-client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileBarChart, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawInstitutionalHeader, loadMunicipioInfo } from "@/lib/pdf-institucional";
import { registrarDocumentoAssinado, drawSignatureStamp, armazenarPdfAssinado } from "@/lib/pdf-signature";
import { resolverAssinaturasDocumento, drawAssinaturasBlock } from "@/lib/pdf-assinaturas";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { RelatoriosTabs } from "@/components/relatorios-tabs";

type TipoFolha = Database["public"]["Enums"]["tipo_frequencia"];
type StatusLinha = Database["public"]["Enums"]["status_linha_frequencia"];

export const Route = createFileRoute("/_authenticated/relatorios-consolidado")({
  component: RelatorioConsolidadoPage,
});

const MES_LABEL = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Row = {
  faltas_injustificadas: number | null;
  atestado: number | null;
  he_50: number | null;
  he_100: number | null;
  adicional_noturno: number | null;
  plantoes_extras: number | null;
  sobreaviso: number | null;
  incentivo: number | null;
  status_linha: StatusLinha;
  frequencias: {
    tipo: TipoFolha;
    competencia_unidades: {
      competencia_id: string;
      unidades: { id: string; nome: string; sigla: string | null } | null;
    } | null;
  } | null;
};

type Agg = {
  unidade_id: string;
  unidade_nome: string;
  qtd: number;
  faltas: number;
  atestado: number;
  he_50: number;
  he_100: number;
  adn: number;
  plantoes: number;
  sobreaviso: number;
  incentivo: number;
  pendentes: number;
  aprovadas: number;
  rejeitadas: number;
};

function RelatorioConsolidadoPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  const [competenciaId, setCompetenciaId] = useState<string>("");
  const [tipo, setTipo] = useState<TipoFolha | "all">("all");

  const { data: competencias } = useQuery({
    queryKey: ["rel-competencias-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, ano, mes, status")
        .is("deleted_at", null)
        .order("ano", { ascending: false })
        .order("mes", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: canView,
  });

  const { data: rows, isLoading } = useQuery<Row[]>({
    queryKey: ["rel-consolidado", competenciaId, tipo],
    enabled: canView && !!competenciaId,
    queryFn: async () => {
      let q = supabase
        .from("frequencia_profissional")
        .select(`
          faltas_injustificadas, atestado, he_50, he_100, adicional_noturno,
          plantoes_extras, sobreaviso, incentivo, status_linha,
          frequencias!inner(
            tipo,
            competencia_unidades!inner(
              competencia_id,
              unidades!inner(id, nome, sigla)
            )
          )
        `)
        .is("deleted_at", null)
        .eq("frequencias.competencia_unidades.competencia_id", competenciaId);
      if (tipo !== "all") q = q.eq("frequencias.tipo", tipo);
      const { data, error } = await q.limit(10000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const aggregated = useMemo<Agg[]>(() => {
    const map = new Map<string, Agg>();
    for (const r of rows ?? []) {
      const u = r.frequencias?.competencia_unidades?.unidades;
      if (!u) continue;
      let a = map.get(u.id);
      if (!a) {
        a = {
          unidade_id: u.id,
          unidade_nome: u.sigla ? `${u.sigla} — ${u.nome}` : u.nome,
          qtd: 0, faltas: 0, atestado: 0, he_50: 0, he_100: 0, adn: 0,
          plantoes: 0, sobreaviso: 0, incentivo: 0,
          pendentes: 0, aprovadas: 0, rejeitadas: 0,
        };
        map.set(u.id, a);
      }
      a.qtd++;
      a.faltas += Number(r.faltas_injustificadas ?? 0);
      a.atestado += Number(r.atestado ?? 0);
      a.he_50 += Number(r.he_50 ?? 0);
      a.he_100 += Number(r.he_100 ?? 0);
      a.adn += Number(r.adicional_noturno ?? 0);
      a.plantoes += Number(r.plantoes_extras ?? 0);
      a.sobreaviso += Number(r.sobreaviso ?? 0);
      a.incentivo += Number(r.incentivo ?? 0);
      if (r.status_linha === "pendente") a.pendentes++;
      else if (r.status_linha === "aprovada") a.aprovadas++;
      else if (r.status_linha === "rejeitada") a.rejeitadas++;
    }
    return Array.from(map.values()).sort((x, y) => x.unidade_nome.localeCompare(y.unidade_nome));
  }, [rows]);

  const totais = useMemo(() => {
    const t: Omit<Agg, "unidade_id" | "unidade_nome"> = {
      qtd: 0, faltas: 0, atestado: 0, he_50: 0, he_100: 0, adn: 0,
      plantoes: 0, sobreaviso: 0, incentivo: 0,
      pendentes: 0, aprovadas: 0, rejeitadas: 0,
    };
    for (const a of aggregated) {
      t.qtd += a.qtd; t.faltas += a.faltas; t.atestado += a.atestado;
      t.he_50 += a.he_50; t.he_100 += a.he_100; t.adn += a.adn;
      t.plantoes += a.plantoes; t.sobreaviso += a.sobreaviso; t.incentivo += a.incentivo;
      t.pendentes += a.pendentes; t.aprovadas += a.aprovadas; t.rejeitadas += a.rejeitadas;
    }
    return t;
  }, [aggregated]);

  const compLabel = useMemo(() => {
    const c = competencias?.find((x) => x.id === competenciaId);
    return c ? `${MES_LABEL[c.mes - 1]}/${c.ano}` : "";
  }, [competencias, competenciaId]);

  const HEADERS = [
    "Unidade", "Qtd. Profissionais", "Total Dias Falta", "Total Atestado",
    "Total HE 50%", "Total HE 100%", "Total ADN", "Total Plantões",
    "Total Sobreaviso", "Total Incentivo", "Pendentes", "Aprovadas", "Rejeitadas",
  ];

  function exportarXLSX() {
    if (!aggregated.length) { toast.error("Nada para exportar."); return; }
    const data = aggregated.map((a) => ({
      "Unidade": a.unidade_nome, "Qtd. Profissionais": a.qtd,
      "Total Dias Falta": a.faltas, "Total Atestado": a.atestado,
      "Total HE 50%": a.he_50, "Total HE 100%": a.he_100, "Total ADN": a.adn,
      "Total Plantões": a.plantoes, "Total Sobreaviso": a.sobreaviso,
      "Total Incentivo": a.incentivo, "Pendentes": a.pendentes,
      "Aprovadas": a.aprovadas, "Rejeitadas": a.rejeitadas,
    }));
    data.push({
      "Unidade": "TOTAL GERAL", "Qtd. Profissionais": totais.qtd,
      "Total Dias Falta": totais.faltas, "Total Atestado": totais.atestado,
      "Total HE 50%": totais.he_50, "Total HE 100%": totais.he_100, "Total ADN": totais.adn,
      "Total Plantões": totais.plantoes, "Total Sobreaviso": totais.sobreaviso,
      "Total Incentivo": totais.incentivo, "Pendentes": totais.pendentes,
      "Aprovadas": totais.aprovadas, "Rejeitadas": totais.rejeitadas,
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
    XLSX.writeFile(wb, `consolidado_${compLabel.replace("/", "-")}.xlsx`);
    toast.success("Planilha exportada.");
  }

  async function exportarPDF() {
    if (!aggregated.length) { toast.error("Nada para exportar."); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const info = await loadMunicipioInfo();
    const startY = drawInstitutionalHeader(doc, info, `Relatório Consolidado — ${compLabel}`);
    doc.setFontSize(10);
    doc.text(`Tipo: ${tipo === "all" ? "Todos" : tipo}`, 14, startY + 4);

    autoTable(doc, {
      startY: startY + 10,
      styles: { fontSize: 7, cellPadding: 1.2 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [HEADERS],
      body: aggregated.map((a) => [
        a.unidade_nome, a.qtd, a.faltas, a.atestado, a.he_50, a.he_100,
        a.adn, a.plantoes, a.sobreaviso, a.incentivo,
        a.pendentes, a.aprovadas, a.rejeitadas,
      ]),
      foot: [[
        "TOTAL GERAL", totais.qtd, totais.faltas, totais.atestado,
        totais.he_50, totais.he_100, totais.adn, totais.plantoes,
        totais.sobreaviso, totais.incentivo,
        totais.pendentes, totais.aprovadas, totais.rejeitadas,
      ]],
      footStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: "bold" },
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, pageHeight - 8);
    const assin = await resolverAssinaturasDocumento("relatorio");
    if (assin.length > 0) {
      drawAssinaturasBlock(doc, assin, { startY: pageHeight - 60 });
    }
    try {
      const sig = await registrarDocumentoAssinado({
        tipo: "relatorio_consolidado",
        descricao: `Relatório Consolidado — ${compLabel} — Tipo: ${tipo === "all" ? "Todos" : tipo}`,
        dados: { competencia: compLabel, tipo, unidades: aggregated.length, totais },
      });
      drawSignatureStamp(doc, sig);
    } catch (err) { logger.error("relatorios_consolidado.signature_failed", { error: err }); }
    doc.save(`consolidado_${compLabel.replace("/", "-")}.pdf`);
    void auditClient.action(AUDIT_ACOES.EXPORT_PDF, {
      tabela: "relatorios",
      contexto: { tipo: "consolidado", competencia: compLabel, tipoFolha: tipo },
    });
  }

  if (permLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;
  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="mt-2 text-muted-foreground">Sem permissão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileBarChart className="h-6 w-6 text-primary" /> Relatório Consolidado
          </h1>
          <p className="text-sm text-muted-foreground">
            Visão gerencial multiunidade por competência.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarPDF} disabled={!canExport || !aggregated.length}>
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button onClick={exportarXLSX} disabled={!canExport || !aggregated.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <RelatoriosTabs />

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Competência *</label>
          <Select value={competenciaId} onValueChange={setCompetenciaId}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MES_LABEL[c.mes - 1]}/{c.ano} — {c.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFolha | "all")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="contratados">Contratados</SelectItem>
              <SelectItem value="efetivos">Efetivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!competenciaId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Selecione uma competência para ver o consolidado.
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={HEADERS.length} className="px-3 py-8 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && !aggregated.length && (
                <tr><td colSpan={HEADERS.length} className="px-3 py-8 text-center text-muted-foreground">Nenhum dado encontrado.</td></tr>
              )}
              {aggregated.map((a) => (
                <tr key={a.unidade_id} className="border-t">
                  <td className="px-3 py-2">{a.unidade_nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.qtd}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.faltas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.atestado}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.he_50}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.he_100}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.adn}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.plantoes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.sobreaviso}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.incentivo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.pendentes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.aprovadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.rejeitadas}</td>
                </tr>
              ))}
              {aggregated.length > 0 && (
                <tr className="border-t bg-muted/50 font-semibold">
                  <td className="px-3 py-2">TOTAL GERAL</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.qtd}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.faltas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.atestado}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.he_50}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.he_100}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.adn}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.plantoes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.sobreaviso}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.incentivo}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.pendentes}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.aprovadas}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{totais.rejeitadas}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
