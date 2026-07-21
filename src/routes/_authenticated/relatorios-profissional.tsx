import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { auditClient, AUDIT_ACOES } from "@/lib/audit-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileBarChart, FileSpreadsheet, Search } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { drawInstitutionalHeader, loadMunicipioInfo } from "@/lib/pdf-institucional";
import { registrarDocumentoAssinado, drawSignatureStamp, armazenarPdfAssinado } from "@/lib/pdf-signature";
import { resolverAssinaturasDocumento, drawAssinaturasBlock } from "@/lib/pdf-assinaturas";
import { toast } from "sonner";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
import type { Database } from "@/integrations/supabase/types";
import { RelatoriosTabs } from "@/components/relatorios-tabs";

type StatusLinha = Database["public"]["Enums"]["status_linha_frequencia"];
type TipoFolha = Database["public"]["Enums"]["tipo_frequencia"];

export const Route = createFileRoute("/_authenticated/relatorios-profissional")({
  // Aceita ?profissionalId=... para pré-seleção vinda de outros módulos
  // (ex.: aba Relatórios da tela de detalhe do profissional).
  validateSearch: (raw: Record<string, unknown>) => ({
    profissionalId: typeof raw.profissionalId === "string" ? raw.profissionalId : undefined,
  }),
  component: RelatorioProfissionalPage,
});

const MES_LABEL = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

type LinhaProf = {
  faltas_injustificadas: number | null;
  atestado: number | null;
  he_50: number | null;
  he_100: number | null;
  adicional_noturno: number | null;
  plantoes_extras: number | null;
  sobreaviso: number | null;
  incentivo: number | null;
  ferias: number | null;
  licenca_premio: number | null;
  status_linha: StatusLinha;
  frequencias: {
    tipo: TipoFolha;
    competencia_unidades: {
      competencias: { id: string; ano: number; mes: number } | null;
    } | null;
  } | null;
};

const CAMPOS_CONTRATADOS = [
  { key: "faltas_injustificadas", label: "Dias Falta" },
  { key: "atestado", label: "Atestado" },
  { key: "he_50", label: "HE 50%" },
  { key: "he_100", label: "HE 100%" },
  { key: "adicional_noturno", label: "ADN" },
  { key: "plantoes_extras", label: "Plantões" },
  { key: "sobreaviso", label: "Sobreaviso" },
  { key: "incentivo", label: "Incentivo" },
] as const;

const CAMPOS_EFETIVOS = [
  { key: "faltas_injustificadas", label: "Dias Falta" },
  { key: "atestado", label: "Atestado" },
  { key: "he_50", label: "HE 50%" },
  { key: "he_100", label: "HE 100%" },
  { key: "licenca_premio", label: "Lic-Prêmio" },
  { key: "ferias", label: "Férias" },
  { key: "plantoes_extras", label: "Plantões" },
  { key: "sobreaviso", label: "Sobreaviso" },
] as const;

const STATUS_LINHA_LABEL: Record<StatusLinha, string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

function toKey(ano: number, mes: number): number {
  return ano * 12 + (mes - 1);
}

function RelatorioProfissionalPage() {
  const { has, isLoading: permLoading } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("relatorio.visualizar");
  const canExport = isMaster || has("relatorio.exportar");

  const { profissionalId: preselectId } = Route.useSearch();

  const [search, setSearch] = useState("");
  const [profissionalId, setProfissionalId] = useState<string>("");
  const [deId, setDeId] = useState<string>("");
  const [ateId, setAteId] = useState<string>("");

  // Se veio ?profissionalId=..., busca o profissional e pré-seleciona no filtro.
  const { data: preselectProf } = useQuery({
    queryKey: ["rel-prof-preselect", preselectId],
    enabled: canView && !!preselectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo, matricula, cpf, vinculos(natureza)")
        .eq("id", preselectId as string)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (preselectProf && !profissionalId) {
      setProfissionalId(preselectProf.id);
      setSearch(preselectProf.nome_completo);
    }
  }, [preselectProf, profissionalId]);

  const { data: competencias } = useQuery({
    queryKey: ["rel-competencias-prof"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("competencias")
        .select("id, ano, mes")
        .is("deleted_at", null)
        .order("ano", { ascending: true })
        .order("mes", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profissionais } = useQuery({
    queryKey: ["rel-prof-search", search],
    enabled: canView && search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome_completo, matricula, cpf, vinculos(natureza)")
        .ilike("nome_completo", `%${search}%`)
        .is("deleted_at", null)
        .eq("status", "ativo")
        .order("nome_completo")
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const profSelecionado = useMemo(
    () => profissionais?.find((p) => p.id === profissionalId),
    [profissionais, profissionalId],
  );

  const deComp = competencias?.find((c) => c.id === deId);
  const ateComp = competencias?.find((c) => c.id === ateId);

  const { data: linhas, isLoading } = useQuery<LinhaProf[]>({
    queryKey: ["rel-prof-linhas", profissionalId, deId, ateId],
    enabled: canView && !!profissionalId && !!deId && !!ateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencia_profissional")
        .select(
          `
          faltas_injustificadas, atestado, he_50, he_100, adicional_noturno,
          plantoes_extras, sobreaviso, incentivo, ferias, licenca_premio, status_linha,
          frequencias!inner(
            tipo,
            competencia_unidades!inner(
              competencias!inner(id, ano, mes)
            )
          )
        `,
        )
        .is("deleted_at", null)
        .eq("profissional_id", profissionalId)
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as LinhaProf[];
    },
  });

  const linhasFiltradas = useMemo(() => {
    if (!linhas || !deComp || !ateComp) return [];
    const min = Math.min(toKey(deComp.ano, deComp.mes), toKey(ateComp.ano, ateComp.mes));
    const max = Math.max(toKey(deComp.ano, deComp.mes), toKey(ateComp.ano, ateComp.mes));
    return linhas
      .filter((l) => {
        const c = l.frequencias?.competencia_unidades?.competencias;
        if (!c) return false;
        const k = toKey(c.ano, c.mes);
        return k >= min && k <= max;
      })
      .sort((a, b) => {
        const ac = a.frequencias!.competencia_unidades!.competencias!;
        const bc = b.frequencias!.competencia_unidades!.competencias!;
        return toKey(ac.ano, ac.mes) - toKey(bc.ano, bc.mes);
      });
  }, [linhas, deComp, ateComp]);

  const tipo: TipoFolha | undefined = linhasFiltradas[0]?.frequencias?.tipo;
  const campos = tipo === "efetivos" ? CAMPOS_EFETIVOS : CAMPOS_CONTRATADOS;

  const chartData = useMemo(
    () =>
      linhasFiltradas.map((l) => {
        const c = l.frequencias!.competencia_unidades!.competencias!;
        return {
          label: `${MES_LABEL[c.mes - 1]}/${String(c.ano).slice(2)}`,
          "HE 50%": Number(l.he_50 ?? 0),
          "HE 100%": Number(l.he_100 ?? 0),
        };
      }),
    [linhasFiltradas],
  );

  function exportarXLSX() {
    if (!linhasFiltradas.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const rows = linhasFiltradas.map((l) => {
      const c = l.frequencias!.competencia_unidades!.competencias!;
      const base: Record<string, string | number> = {
        Competência: `${String(c.mes).padStart(2, "0")}/${c.ano}`,
      };
      for (const f of campos) {
        base[f.label] = Number((l as unknown as Record<string, number | null>)[f.key] ?? 0);
      }
      base["Status Linha"] = STATUS_LINHA_LABEL[l.status_linha];
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    XLSX.writeFile(wb, `profissional_${profSelecionado?.nome_completo ?? "hist"}.xlsx`);
    toast.success("Planilha exportada.");
  }

  async function exportarPDF() {
    if (!linhasFiltradas.length) {
      toast.error("Nada para exportar.");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const info = await loadMunicipioInfo();
    const startY = drawInstitutionalHeader(
      doc,
      info,
      `Histórico do Profissional — ${profSelecionado?.nome_completo ?? ""}`,
    );
    doc.setFontSize(10);
    doc.text(
      `Matrícula: ${profSelecionado?.matricula ?? "—"}  |  Tipo: ${tipo ?? "—"}`,
      14,
      startY + 4,
    );

    autoTable(doc, {
      startY: startY + 10,
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [30, 41, 59] },
      head: [["Competência", ...campos.map((c) => c.label), "Status"]],
      body: linhasFiltradas.map((l) => {
        const c = l.frequencias!.competencia_unidades!.competencias!;
        return [
          `${String(c.mes).padStart(2, "0")}/${c.ano}`,
          ...campos.map((f) => Number((l as unknown as Record<string, number | null>)[f.key] ?? 0)),
          STATUS_LINHA_LABEL[l.status_linha],
        ];
      }),
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 14, pageHeight - 8);
    const assinProf = await resolverAssinaturasDocumento("relatorio");
    if (assinProf.length > 0) {
      drawAssinaturasBlock(doc, assinProf, { startY: pageHeight - 60 });
    }
    let _sigProf: Awaited<ReturnType<typeof registrarDocumentoAssinado>> | null = null;
    try {
      const sig = await registrarDocumentoAssinado({
        tipo: "relatorio_profissional",
        referencia_id: profSelecionado?.id ?? null,
        descricao: `Histórico do Profissional — ${profSelecionado?.nome_completo ?? ""} — Matrícula ${profSelecionado?.matricula ?? "—"}`,
        dados: {
          profissional_id: profSelecionado?.id,
          nome: profSelecionado?.nome_completo,
          matricula: profSelecionado?.matricula,
          tipo,
          linhas: linhasFiltradas.length,
        },
      });
      drawSignatureStamp(doc, sig);
      _sigProf = sig;
    } catch (err) {
      logger.error("relatorios_profissional.signature_failed", { error: err });
    }
    if (_sigProf) {
      try { await armazenarPdfAssinado(_sigProf, doc.output("blob")); } catch { /* best effort */ }
    }
    doc.save(`profissional_${profSelecionado?.nome_completo ?? "hist"}.pdf`);
    void auditClient.action(AUDIT_ACOES.EXPORT_PDF, {
      tabela: "profissionais",
      registro_id: profSelecionado?.id ?? null,
      contexto: {
        tipo: "relatorio_profissional",
        matricula: profSelecionado?.matricula,
        tipoFolha: tipo,
      },
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
            <FileBarChart className="h-6 w-6 text-primary" /> Relatório por Profissional
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico entre competências e tendência de horas extras.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={exportarPDF}
            disabled={!canExport || !linhasFiltradas.length}
          >
            <Download className="mr-2 h-4 w-4" /> PDF
          </Button>
          <Button onClick={exportarXLSX} disabled={!canExport || !linhasFiltradas.length}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <RelatoriosTabs />

      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Buscar profissional
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Digite o nome (mínimo 2 letras)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {profissionais && profissionais.length > 0 && (
            <Select value={profissionalId} onValueChange={setProfissionalId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione o profissional..." />
              </SelectTrigger>
              <SelectContent>
                {profissionais.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo}
                    {p.matricula ? ` — ${p.matricula}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            De (competência)
          </label>
          <Select value={deId} onValueChange={setDeId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MES_LABEL[c.mes - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Até (competência)
          </label>
          <Select value={ateId} onValueChange={setAteId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {competencias?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {MES_LABEL[c.mes - 1]}/{c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!profissionalId || !deId || !ateId ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Selecione um profissional e o intervalo de competências.
        </div>
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 text-sm font-medium">Evolução de Horas Extras</div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="HE 50%" fill="hsl(var(--primary))" />
                    <Bar dataKey="HE 100%" fill="hsl(var(--destructive))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="overflow-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Competência</th>
                  {campos.map((c) => (
                    <th key={c.key} className="px-3 py-2 text-right whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td
                      colSpan={campos.length + 2}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && !linhasFiltradas.length && (
                  <tr>
                    <td
                      colSpan={campos.length + 2}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      Sem registros no intervalo.
                    </td>
                  </tr>
                )}
                {linhasFiltradas.map((l, i) => {
                  const c = l.frequencias!.competencia_unidades!.competencias!;
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">
                        {String(c.mes).padStart(2, "0")}/{c.ano}
                      </td>
                      {campos.map((f) => (
                        <td key={f.key} className="px-3 py-2 text-right tabular-nums">
                          {Number((l as unknown as Record<string, number | null>)[f.key] ?? 0)}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <Badge variant="outline">{STATUS_LINHA_LABEL[l.status_linha]}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
