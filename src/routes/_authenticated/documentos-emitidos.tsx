import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldOff,
  ExternalLink,
  Ban,
  Signature,
  FileSpreadsheet,
  FileText,
  Download,
} from "lucide-react";
import { FilterBar } from "@/components/shared/FilterBar";
import { downloadXlsx } from "@/lib/xlsx-export";
import { BotaoRelatorioAbnt } from "@/components/relatorios-gerenciais/botao-relatorio-abnt";
import { relatorioPainelAbnt } from "@/lib/painel-abnt";

export const Route = createFileRoute("/_authenticated/documentos-emitidos")({
  errorComponent: ErrorComponent,
  component: DocumentosEmitidosPage,
});

const PAGE_SIZE = 50;

type DocRow = {
  id: string;
  tipo: string;
  descricao: string;
  assinado_por_nome: string | null;
  assinado_em: string;
  status: string;
  revogado_em: string | null;
  motivo_revogacao: string | null;
  hash_conteudo: string;
  codigo_validacao: string;
  pdf_storage_path: string | null;
};

function DocumentosEmitidosPage() {
  const { has } = usePermissions();
  const { data: me } = useCurrentUser();
  const isMaster = !!me?.is_master;
  const canView = isMaster || has("documento.gerenciar") || has("relatorio.exportar");

  const qc = useQueryClient();
  const [tipo, setTipo] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [desde, setDesde] = useState<string>("");
  const [ate, setAte] = useState<string>("");
  const [page, setPage] = useState(0);

  const [revogar, setRevogar] = useState<DocRow | null>(null);
  const [motivo, setMotivo] = useState("");

  function resetPagina<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(0);
      setter(v);
    };
  }

  /** Lista de tipos existentes (para o filtro), independente da paginação. */
  const { data: tipos = [] } = useQuery({
    queryKey: ["documentos-emitidos-tipos"],
    enabled: canView,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos_assinados")
        .select("documento_tipo")
        .order("documento_tipo")
        .limit(2000);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((d) => d.documento_tipo))).sort();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["documentos-emitidos", tipo, status, desde, ate, busca, page],
    enabled: canView,
    queryFn: async () => {
      let q = supabase
        .from("documentos_assinados")
        .select(
          "id, documento_tipo, descricao, nome_assinante, assinado_em, status, revogado_em, motivo_revogacao, hash_sha256, codigo_validacao, pdf_storage_path, metadata",
          { count: "exact" },
        )
        .order("assinado_em", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (desde) q = q.gte("assinado_em", desde);
      if (ate) q = q.lte("assinado_em", `${ate}T23:59:59`);
      if (tipo !== "all") q = q.eq("documento_tipo", tipo);
      if (status !== "all") q = q.eq("status", status);

      const termo = busca.trim();
      if (termo) {
        const escapado = termo.replace(/[%,()]/g, " ");
        q = q.or(
          `descricao.ilike.%${escapado}%,nome_assinante.ilike.%${escapado}%,codigo_validacao.ilike.%${escapado}%,hash_sha256.ilike.%${escapado}%`,
        );
      }

      const { data, error, count } = await q;
      if (error) throw error;

      const rows: DocRow[] = (data ?? []).map((d) => ({
        id: d.id,
        tipo: d.documento_tipo,
        descricao:
          d.descricao ??
          ((d.metadata as Record<string, unknown> | null)?.["filename"] as string | undefined) ??
          `${d.documento_tipo} (sem descrição)`,
        assinado_por_nome: d.nome_assinante,
        assinado_em: d.assinado_em,
        status: d.status ?? "ativo",
        revogado_em: d.revogado_em,
        motivo_revogacao: d.motivo_revogacao,
        hash_conteudo: d.hash_sha256,
        codigo_validacao: d.codigo_validacao,
        pdf_storage_path:
          d.pdf_storage_path ??
          (((d.metadata as Record<string, unknown> | null)?.["pdf_storage_path"] as
            | string
            | undefined) ??
            null),
      }));

      return { rows, total: count ?? rows.length };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Contadores do período/filtro atual (sem a paginação). */
  const { data: kpis } = useQuery({
    queryKey: ["documentos-emitidos-kpis", desde, ate, tipo],
    enabled: canView,
    queryFn: async () => {
      const base = () => {
        let q = supabase
          .from("documentos_assinados")
          .select("id", { count: "exact", head: true });
        if (desde) q = q.gte("assinado_em", desde);
        if (ate) q = q.lte("assinado_em", `${ate}T23:59:59`);
        if (tipo !== "all") q = q.eq("documento_tipo", tipo);
        return q;
      };
      const [emitidos, ativos, revogados] = await Promise.all([
        base(),
        base().eq("status", "ativo"),
        base().eq("status", "revogado"),
      ]);
      return {
        emitidos: emitidos.count ?? 0,
        ativos: ativos.count ?? 0,
        revogados: revogados.count ?? 0,
      };
    },
  });

  const revogarMut = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      // Rotina oficial: valida autor/Master, exige motivo e grava auditoria.
      const { error } = await supabase.rpc("revogar_documento_assinado", {
        _id: id,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento revogado com sucesso.");
      setRevogar(null);
      setMotivo("");
      qc.invalidateQueries({ queryKey: ["documentos-emitidos"] });
      qc.invalidateQueries({ queryKey: ["documentos-emitidos-kpis"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : "Falha ao revogar.");
    },
  });

  async function baixarOriginal(d: DocRow) {
    if (!d.pdf_storage_path) {
      toast.error("O arquivo original deste documento não foi guardado.");
      return;
    }
    const signed = await supabase.storage
      .from("documentos-assinados")
      .createSignedUrl(d.pdf_storage_path, 60);
    if (signed.error || !signed.data?.signedUrl) {
      toast.error("Não foi possível gerar o link de download.");
      return;
    }
    window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const filtrosDescritivos = useMemo(
    () => [
      { label: "Tipo", valor: tipo === "all" ? "Todos" : tipo },
      {
        label: "Situação",
        valor: status === "all" ? "Todas" : status === "ativo" ? "Ativos" : "Revogados",
      },
      { label: "Período", valor: `${desde || "início"} a ${ate || "hoje"}` },
      { label: "Busca", valor: busca.trim() || "—" },
    ],
    [tipo, status, desde, ate, busca],
  );

  function exportarExcel() {
    if (!rows.length) {
      toast.error("Nada para exportar com os filtros atuais.");
      return;
    }
    downloadXlsx(
      "documentos-emitidos",
      rows,
      [
        { header: "Protocolo", value: (d) => d.codigo_validacao, largura: 22 },
        { header: "Tipo", value: (d) => d.tipo, largura: 22 },
        { header: "Descrição", value: (d) => d.descricao, largura: 55 },
        { header: "Autor", value: (d) => d.assinado_por_nome ?? "—", largura: 30 },
        {
          header: "Emitido em",
          value: (d) => new Date(d.assinado_em).toLocaleString("pt-BR"),
          largura: 20,
        },
        {
          header: "Situação",
          value: (d) => (d.status === "revogado" ? "Revogado" : "Ativo"),
          largura: 14,
        },
        { header: "Motivo da revogação", value: (d) => d.motivo_revogacao ?? "—", largura: 45 },
        { header: "Hash SHA-256", value: (d) => d.hash_conteudo, largura: 50 },
      ],
      { sheetName: "Documentos", titulo: "Documentos emitidos" },
    );
  }

  if (!canView) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Você não tem permissão para visualizar esta tela.
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Documentos Emitidos</h1>
          <p className="text-sm text-muted-foreground">
            Trilha oficial de todos os documentos assinados eletronicamente. Autor ou Master pode
            revogar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel} disabled={!rows.length}>
            <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
          </Button>
          <BotaoRelatorioAbnt
            size="sm"
            variant="outline"
            disabled={!rows.length}
            relatorio={() =>
              relatorioPainelAbnt({
                arquivo: "documentos-emitidos",
                titulo: "Documentos Emitidos",
                subtitulo: "Trilha oficial de documentos assinados eletronicamente",
                orientacao: "landscape",
                filtros: filtrosDescritivos,
                kpis: [
                  { label: "Emitidos no filtro", valor: kpis?.emitidos ?? total },
                  { label: "Ativos", valor: kpis?.ativos ?? 0 },
                  { label: "Revogados", valor: kpis?.revogados ?? 0 },
                  { label: "Exibidos nesta página", valor: rows.length },
                ],
                blocos: [
                  {
                    titulo: "Relação de documentos",
                    head: ["Protocolo", "Tipo", "Descrição", "Autor", "Emitido em", "Situação"],
                    align: ["left", "left", "left", "left", "center", "center"],
                    larguras: [35, 30, 75, 40, 30, 20],
                    body: rows.map((d) => [
                      d.codigo_validacao,
                      d.tipo,
                      d.descricao,
                      d.assinado_por_nome ?? "—",
                      new Date(d.assinado_em).toLocaleString("pt-BR"),
                      d.status === "revogado" ? "Revogado" : "Ativo",
                    ]),
                  },
                ],
                registros: rows.length,
              })
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Emitidos no filtro", valor: kpis?.emitidos ?? total },
          { label: "Ativos", valor: kpis?.ativos ?? 0 },
          { label: "Revogados", valor: kpis?.revogados ?? 0 },
          { label: "Exibidos nesta página", valor: rows.length },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-semibold">{k.valor}</p>
          </div>
        ))}
      </div>

      <FilterBar>
        <FilterBar.Field label="Busca">
          <Input
            value={busca}
            onChange={(e) => resetPagina(setBusca)(e.target.value)}
            placeholder="Descrição, autor, protocolo, hash..."
          />
        </FilterBar.Field>
        <FilterBar.Field label="Tipo">
          <Select value={tipo} onValueChange={resetPagina(setTipo)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="Situação">
          <Select value={status} onValueChange={resetPagina(setStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="revogado">Revogados</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar.Field>
        <FilterBar.Field label="De">
          <Input
            type="date"
            value={desde}
            onChange={(e) => resetPagina(setDesde)(e.target.value)}
          />
        </FilterBar.Field>
        <FilterBar.Field label="Até">
          <Input type="date" value={ate} onChange={(e) => resetPagina(setAte)(e.target.value)} />
        </FilterBar.Field>
      </FilterBar>

      <div className="rounded-lg border overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Protocolo</th>
              <th className="px-3 py-2 text-left">Tipo</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-left">Autor</th>
              <th className="px-3 py-2 text-left">Data</th>
              <th className="px-3 py-2 text-left">Situação</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Nenhum documento encontrado.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{d.codigo_validacao}</td>
                  <td className="px-3 py-2">{d.tipo}</td>
                  <td className="px-3 py-2 max-w-[380px] truncate" title={d.descricao}>
                    {d.descricao}
                  </td>
                  <td className="px-3 py-2">{d.assinado_por_nome ?? "—"}</td>
                  <td className="px-3 py-2">{new Date(d.assinado_em).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    {d.status === "revogado" ? (
                      <Badge
                        variant="destructive"
                        className="gap-1"
                        title={d.motivo_revogacao ?? undefined}
                      >
                        <ShieldOff className="h-3 w-3" /> Revogado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <ShieldCheck className="h-3 w-3" /> Ativo
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      {d.pdf_storage_path && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Baixar o PDF original"
                          onClick={() => void baixarOriginal(d)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {d.pdf_storage_path && (
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to="/assinar-pdf"
                            search={{
                              fileUrl: `${window.location.origin}/api/public/documento-pdf/${d.id}`,
                              fileName: `${d.descricao.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`,
                            }}
                            title="Assinar este documento novamente com posicionamento livre"
                          >
                            <Signature className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost" title="Abrir validação pública">
                        <Link
                          to="/validar/$id"
                          params={{ id: d.codigo_validacao || d.id }}
                          target="_blank"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {d.status !== "revogado" && (
                        <Button size="sm" variant="outline" onClick={() => setRevogar(d)}>
                          <Ban className="h-3.5 w-3.5 mr-1" /> Revogar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> {total} documento(s) no filtro — página {page + 1} de{" "}
          {totalPaginas}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPaginas}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Dialog
        open={!!revogar}
        onOpenChange={(o) => {
          if (!o) {
            setRevogar(null);
            setMotivo("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar documento</DialogTitle>
            <DialogDescription>
              A revogação é <strong>irreversível</strong> e ficará registrada na trilha de
              auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-md bg-muted/40 p-2">
              <p className="text-xs text-muted-foreground">Documento</p>
              <p className="font-medium">{revogar?.descricao}</p>
            </div>
            <label className="text-xs text-muted-foreground">
              Motivo (obrigatório, mínimo 5 caracteres)
            </label>
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: erro de digitação na competência, versão substituída por..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRevogar(null);
                setMotivo("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 5 || revogarMut.isPending}
              onClick={() =>
                revogar && revogarMut.mutate({ id: revogar.id, motivo: motivo.trim() })
              }
            >
              {revogarMut.isPending ? "Revogando..." : "Confirmar revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
