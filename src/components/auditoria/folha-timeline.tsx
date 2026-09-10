/**
 * Linha do Tempo da Folha (Audit Trail).
 * Cobre as 6 etapas do fluxo documentado: Lançamento, Fechamento, Geração,
 * Envio, Análise e Homologação — com autor, data/hora e IP quando disponíveis.
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
import { CheckCircle2, CircleDashed, FileDown, GitCommitVertical } from "lucide-react";
import { toast } from "sonner";
import { statusLabel } from "@/lib/status";
import {
  drawCertificadoRodape,
  drawWatermark,
  gerarCertificado,
  registrarDownload,
} from "@/lib/fe-publica";
import type { NivelPrivacidade } from "@/lib/lgpd";

/** As 6 etapas do fluxo institucional da folha. */
const ETAPAS = [
  "Lançamento",
  "Fechamento",
  "Geração",
  "Envio",
  "Análise",
  "Homologação",
] as const;
type EtapaNome = (typeof ETAPAS)[number];

type Etapa = {
  quando: string;
  etapa: EtapaNome;
  titulo: string;
  autor: string;
  detalhe: string | null;
  ip: string | null;
};

function etapaPorStatus(status: string | null | undefined, acao?: string | null): EtapaNome {
  const s = (status ?? "").toLowerCase();
  const a = (acao ?? "").toLowerCase();
  if (s === "enviada" || a.includes("envio")) return "Envio";
  if (s === "em_analise" || a.includes("análise") || a.includes("analise")) return "Análise";
  if (s === "aprovada" || a.includes("aprov") || a.includes("homolog")) return "Homologação";
  if (s === "rejeitada" || s === "devolvida" || s === "com_pendencias") return "Análise";
  if (s === "rascunho") return "Lançamento";
  return "Geração";
}

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
             competencia_id, unidade_id,
             unidade:unidades!inner(nome, sigla),
             competencia:competencias!inner(ano, mes, status, prazo_envio)
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
      const competenciaId = folha?.competencia_unidade?.competencia_id ?? null;
      const unidadeId = folha?.competencia_unidade?.unidade_id ?? null;
      const [aprov, hist, logs, logsComp, logsLegado] = await Promise.all([
        supabase
          .from("frequencia_aprovacoes")
          .select("acao, status_anterior, status_novo, observacoes, created_at, executado_por")
          .eq("frequencia_id", folhaId)
          .order("created_at"),
        supabase
          .from("frequencia_historico")
          .select(
            "acao, status_anterior, status_novo, justificativa, created_at, executado_por, executado_nome, executado_perfil",
          )
          .eq("frequencia_id", folhaId)
          .order("created_at"),
        supabase
          .from("audit_log")
          .select(
            "ocorrido_em, operacao, usuario_id, usuario_email, ip, contexto, valor_anterior, valor_novo",
          )
          .eq("registro_id", folhaId)
          .order("ocorrido_em")
          .limit(300),
        competenciaId
          ? supabase
              .from("audit_log")
              .select("ocorrido_em, operacao, usuario_email, ip, valor_novo")
              .eq("tabela", "competencias")
              .eq("registro_id", competenciaId)
              .order("ocorrido_em")
              .limit(100)
          : Promise.resolve({ data: [] as never[] }),
        // Eventos legados de sincronização: gravados sem vínculo direto à folha,
        // identificados apenas pelo contexto (competência + unidade + tipo).
        competenciaId
          ? supabase
              .from("audit_log")
              .select("ocorrido_em, operacao, usuario_id, usuario_email, ip, contexto")
              .is("registro_id", null)
              .filter("contexto->>competencia_id", "eq", competenciaId)
              .order("ocorrido_em")
              .limit(500)
          : Promise.resolve({ data: [] as never[] }),
      ]);

      const ids = new Set<string>();
      for (const a of aprov.data ?? []) if (a.executado_por) ids.add(a.executado_por);
      for (const h of hist.data ?? []) if (h.executado_por) ids.add(h.executado_por);
      for (const l of logs.data ?? []) if (l.usuario_id) ids.add(l.usuario_id);
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
      const naoIdentificado = "não identificado (investigar)";

      const out: Etapa[] = [];

      // Etapa 1 — Lançamento
      if (folha?.created_at) {
        out.push({
          quando: folha.created_at,
          etapa: "Lançamento",
          titulo: "Folha criada / lançamento iniciado",
          autor: nomes.get(folha.created_by ?? "") ?? naoIdentificado,
          detalhe: folha.tipo === "contratados" ? "Folha de contratados" : "Folha de efetivos",
          ip: null,
        });
      }

      // Etapa 2 — Fechamento (encerramento da competência / prazo)
      for (const l of logsComp.data ?? []) {
        const vn = (l.valor_novo ?? {}) as { status?: string; prazo_envio?: string };
        if (vn.status === "encerrada" || vn.status === "arquivada") {
          out.push({
            quando: l.ocorrido_em,
            etapa: "Fechamento",
            titulo: `Competência ${vn.status === "encerrada" ? "encerrada" : "arquivada"} — edições bloqueadas`,
            autor: l.usuario_email ?? naoIdentificado,
            detalhe: null,
            ip: l.ip,
          });
        }
      }

      // Etapa 3 — Geração / consolidação (eventos de sincronização e gravação)
      for (const l of logs.data ?? []) {
        const ctx = (l.contexto ?? {}) as {
          acao?: string;
          evento?: string;
          total_profissionais?: number;
        };
        const evento = ctx.evento ?? "";
        const etapa: EtapaNome = evento.includes("ENVIADA")
          ? "Envio"
          : evento.includes("APROVADA")
            ? "Homologação"
            : etapaPorStatus(null, ctx.acao);
        out.push({
          quando: l.ocorrido_em,
          etapa,
          titulo: `Registro de auditoria — ${ctx.evento ?? ctx.acao ?? l.operacao}`,
          autor: l.usuario_email ?? nomes.get(l.usuario_id ?? "") ?? naoIdentificado,
          detalhe:
            ctx.total_profissionais != null
              ? `${ctx.total_profissionais} profissionais consolidados`
              : null,
          ip: l.ip,
        });
      }

      // Etapas 4/5/6 — histórico de status (envio, análise, homologação)
      for (const h of hist.data ?? []) {
        out.push({
          quando: h.created_at,
          etapa: etapaPorStatus(h.status_novo, h.acao),
          titulo: h.acao ?? "Transição de status",
          autor:
            h.executado_nome ?? nomes.get(h.executado_por ?? "") ?? naoIdentificado,
          detalhe: `${statusLabel("frequencia", h.status_anterior)} ➔ ${statusLabel("frequencia", h.status_novo)}${h.justificativa ? ` · ${h.justificativa}` : ""}${h.executado_perfil ? ` · perfil ${h.executado_perfil}` : ""}`,
          ip: null,
        });
      }

      for (const a of aprov.data ?? []) {
        out.push({
          quando: a.created_at,
          etapa: etapaPorStatus(a.status_novo, a.acao),
          titulo: `Validação — ${a.acao}`,
          autor: nomes.get(a.executado_por ?? "") ?? naoIdentificado,
          detalhe: `${statusLabel("frequencia", a.status_anterior)} ➔ ${statusLabel("frequencia", a.status_novo)}${a.observacoes ? ` · ${a.observacoes}` : ""}`,
          ip: null,
        });
      }

      // Marcos consolidados da própria folha (garantem Envio/Homologação visíveis)
      if (folha?.data_envio && !out.some((e) => e.etapa === "Envio")) {
        out.push({
          quando: folha.data_envio,
          etapa: "Envio",
          titulo: "Enviada para análise",
          autor: nomes.get(folha.enviada_por ?? "") ?? naoIdentificado,
          detalhe: null,
          ip: null,
        });
      }
      if (folha?.data_aprovacao && !out.some((e) => e.etapa === "Homologação")) {
        out.push({
          quando: folha.data_aprovacao,
          etapa: "Homologação",
          titulo: "Aprovação / homologação da folha",
          autor: nomes.get(folha.aprovada_por ?? "") ?? naoIdentificado,
          detalhe: null,
          ip: null,
        });
      }

      return out.sort((a, b) => a.quando.localeCompare(b.quando));
    },
  });

  const cobertura = useMemo(() => {
    const set = new Set((etapas ?? []).map((e) => e.etapa));
    return ETAPAS.map((e) => ({ etapa: e, ok: set.has(e) }));
  }, [etapas]);

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
    doc.setFontSize(8);
    doc.text(
      `Cobertura das etapas: ${cobertura.map((c2) => `${c2.etapa}${c2.ok ? " ✔" : " (sem registro)"}`).join(" · ")}`,
      14,
      y + 5,
    );
    autoTable(doc, {
      startY: y + 10,
      head: [["Data/hora", "Etapa", "Evento", "Responsável", "Detalhe", "IP"]],
      body: etapas.map((e) => [
        new Date(e.quando).toLocaleString("pt-BR"),
        e.etapa,
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

      {folhaId && (
        <div className="flex flex-wrap gap-2 rounded-md border bg-muted/30 p-3">
          {cobertura.map((c) => (
            <Badge
              key={c.etapa}
              variant={c.ok ? "secondary" : "outline"}
              className="gap-1 text-[11px]"
            >
              {c.ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              ) : (
                <CircleDashed className="h-3 w-3 text-muted-foreground" />
              )}
              {c.etapa}
              {!c.ok && " · sem registro"}
            </Badge>
          ))}
        </div>
      )}

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
                <Badge variant="secondary" className="text-[10px] uppercase">
                  {e.etapa}
                </Badge>
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
