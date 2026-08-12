/**
 * Linha do Tempo da Folha (Audit Trail).
 * Upload/criação ➔ envio ➔ validação ➔ aprovação/fechamento, com autor, data/hora e IP.
 * Exportação em PDF com marca d'água de rastreio e certificado de fé pública.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { finalizarPdf } from "@/lib/pdf-pipeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDown, GitCommitVertical } from "lucide-react";
import { toast } from "sonner";
import { statusLabel } from "@/lib/status";
import {
  drawCertificadoRodape,
  drawWatermark,
  gerarCertificado,
  registrarDownload,
} from "@/lib/fe-publica";
import type { NivelPrivacidade } from "@/lib/lgpd";

type Etapa = {
  quando: string;
  titulo: string;
  autor: string;
  detalhe: string | null;
  ip: string | null;
};

export function FolhaTimeline({
  nivel,
  usuario,
}: {
  nivel: NivelPrivacidade;
  usuario: { nome: string; identificador: string };
}) {
  const [folhaId, setFolhaId] = useState<string>("");

  const { data: folhas } = useQuery({
    queryKey: ["audit-folhas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("frequencias")
        .select(
          `id, tipo, status, created_at, created_by, data_envio, enviada_por,
           data_aprovacao, aprovada_por,
           competencia_unidade:competencia_unidades!inner(
             unidade:unidades!inner(nome, sigla),
             competencia:competencias!inner(ano, mes)
           )`,
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const folha = useMemo(
    () => (folhas ?? []).find((f) => f.id === folhaId) ?? null,
    [folhas, folhaId],
  );

  const { data: etapas, isLoading } = useQuery<Etapa[]>({
    queryKey: ["audit-folha-timeline", folhaId],
    enabled: !!folhaId,
    queryFn: async () => {
      const [aprov, logs] = await Promise.all([
        supabase
          .from("frequencia_aprovacoes")
          .select("acao, status_anterior, status_novo, observacoes, created_at, executado_por")
          .eq("frequencia_id", folhaId)
          .order("created_at"),
        supabase
          .from("audit_log")
          .select("ocorrido_em, operacao, usuario_email, ip, contexto")
          .eq("registro_id", folhaId)
          .order("ocorrido_em")
          .limit(200),
      ]);

      const ids = new Set<string>();
      for (const a of aprov.data ?? []) if (a.executado_por) ids.add(a.executado_por);
      if (folha?.created_by) ids.add(folha.created_by);
      if (folha?.enviada_por) ids.add(folha.enviada_por);
      if (folha?.aprovada_por) ids.add(folha.aprovada_por);

      const nomes = new Map<string, string>();
      if (ids.size) {
        const { data: us } = await supabase
          .from("usuarios")
          .select("id, nome_completo, email")
          .in("id", Array.from(ids));
        for (const u of us ?? []) nomes.set(u.id, u.nome_completo ?? u.email ?? u.id);
      }

      const out: Etapa[] = [];
      if (folha?.created_at) {
        out.push({
          quando: folha.created_at,
          titulo: "Folha criada / upload realizado",
          autor: nomes.get(folha.created_by ?? "") ?? "sistema",
          detalhe: folha.tipo === "contratados" ? "Folha de contratados" : "Folha de efetivos",
          ip: null,
        });
      }
      if (folha?.data_envio) {
        out.push({
          quando: folha.data_envio,
          titulo: "Enviada para aprovação",
          autor: nomes.get(folha.enviada_por ?? "") ?? "—",
          detalhe: null,
          ip: null,
        });
      }
      for (const a of aprov.data ?? []) {
        out.push({
          quando: a.created_at,
          titulo: `Validação — ${a.acao}`,
          autor: nomes.get(a.executado_por ?? "") ?? "—",
          detalhe: `${statusLabel("frequencia", a.status_anterior)} ➔ ${statusLabel("frequencia", a.status_novo)}${a.observacoes ? ` · ${a.observacoes}` : ""}`,
          ip: null,
        });
      }
      if (folha?.data_aprovacao) {
        out.push({
          quando: folha.data_aprovacao,
          titulo: "Aprovação / fechamento",
          autor: nomes.get(folha.aprovada_por ?? "") ?? "—",
          detalhe: null,
          ip: null,
        });
      }
      for (const l of logs.data ?? []) {
        const ctx = (l.contexto ?? {}) as { acao?: string };
        out.push({
          quando: l.ocorrido_em,
          titulo: `Registro de auditoria — ${ctx.acao ?? l.operacao}`,
          autor: l.usuario_email ?? "sistema",
          detalhe: null,
          ip: l.ip,
        });
      }
      return out.sort((a, b) => a.quando.localeCompare(b.quando));
    },
  });

  async function exportarPdf() {
    if (!folha || !etapas?.length) {
      toast.error("Selecione uma folha com histórico.");
      return;
    }
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const { drawInstitutionalHeader, loadMunicipioInfo } = await import("@/lib/pdf-institucional");

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const info = await loadMunicipioInfo();
    const c = folha.competencia_unidade?.competencia;
    const u = folha.competencia_unidade?.unidade;
    const y = drawInstitutionalHeader(doc, info, "TRILHA DE AUDITORIA DA FOLHA");
    doc.setFontSize(9);
    doc.text(
      `${u?.sigla ? `${u.sigla} — ` : ""}${u?.nome ?? "—"} · Competência ${c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "—"} · ${folha.tipo === "contratados" ? "Contratados" : "Efetivos"}`,
      14,
      y,
    );
    autoTable(doc, {
      startY: y + 4,
      head: [["Data/hora", "Etapa", "Responsável", "Detalhe", "IP"]],
      body: etapas.map((e) => [
        new Date(e.quando).toLocaleString("pt-BR"),
        e.titulo,
        e.autor,
        e.detalhe ?? "",
        e.ip ?? "",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4 },
      headStyles: { fillColor: [92, 64, 32], textColor: 255 },
      margin: { left: 14, right: 14, bottom: 24 },
    });

    const cert = await gerarCertificado({ conteudo: { folha: folha.id, etapas }, usuario });
    if (nivel === "completo") drawWatermark(doc, cert.rastreio);
    drawCertificadoRodape(doc, cert);
    await finalizarPdf(doc, {
      filename: `trilha_folha_${folha.id.slice(0, 8)}.pdf`,
      tipo: "relatorio",
    });
    registrarDownload({
      relatorio: "auditoria.trilha_folha",
      formato: "pdf",
      filtros: { folha_id: folha.id },
      hash: cert.hash,
      registros: etapas.length,
    });
    toast.success("Trilha exportada com fé pública.");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xl">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Folha (competência · unidade · tipo)
          </label>
          <Select value={folhaId} onValueChange={setFolhaId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma folha" />
            </SelectTrigger>
            <SelectContent>
              {(folhas ?? []).map((f) => {
                const c = f.competencia_unidade?.competencia;
                const u = f.competencia_unidade?.unidade;
                return (
                  <SelectItem key={f.id} value={f.id}>
                    {c ? `${String(c.mes).padStart(2, "0")}/${c.ano}` : "—"} ·{" "}
                    {u?.sigla ?? u?.nome ?? "—"} ·{" "}
                    {f.tipo === "contratados" ? "Contratados" : "Efetivos"}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => void exportarPdf()} disabled={!etapas?.length}>
          <FileDown className="mr-2 h-4 w-4" /> PDF com fé pública
        </Button>
      </div>

      {!folhaId ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Escolha uma folha para ver o histórico passo a passo.
        </p>
      ) : isLoading ? (
        <p className="p-6 text-center text-sm text-muted-foreground">Carregando trilha...</p>
      ) : !etapas?.length ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhum evento registrado para esta folha.
        </p>
      ) : (
        <ol className="relative space-y-4 border-l pl-6">
          {etapas.map((e, i) => (
            <li key={i} className="relative">
              <GitCommitVertical className="absolute -left-[31px] top-0 h-4 w-4 text-primary" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{e.titulo}</span>
                <Badge variant="outline" className="text-[11px]">
                  {new Date(e.quando).toLocaleString("pt-BR")}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Responsável: {e.autor}
                {e.ip ? ` · IP ${e.ip}` : ""}
              </div>
              {e.detalhe && <div className="mt-0.5 text-xs">{e.detalhe}</div>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
