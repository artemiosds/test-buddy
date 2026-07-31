import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  Copy,
  Download,
  Eye,
  Pencil,
  Plus,
  Power,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PermissionGate } from "@/components/permission-gate";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { campoCatalogo, camposPorGrupo, labelCampoInterno } from "@/lib/layout-campos-catalogo";

import {
  alterarSituacaoLayout,
  criarLayout,
  criarNovaVersao,
  duplicarLayout,
  getLayout,
  listLayouts,
  listUsoLayouts,
} from "@/lib/layout-engine.functions";
import {
  atualizarAliasCatalogo,
  definirClassificacaoLayout,
  estatisticasLayouts,
  exportarLayout,
  importarLayoutPacote,
  listHistoricoAliases,
  listSugestoesAlias,
  resolverSugestaoAlias,
} from "@/lib/layout-inteligencia.functions";
import {
  CLASSIFICACOES,
  LABEL_CLASSIFICACAO,
  LABEL_OBRIGATORIEDADE,
  aplicarObrigatoriedade,
  classificacaoValida,
  estadoObrigatoriedade,
  nomeArquivoPacote,
  type EstadoObrigatoriedade,
} from "@/lib/layout-inteligencia";
import type { LayoutCampo } from "@/lib/layout-engine";


export const Route = createFileRoute("/_authenticated/layouts-importacao")({
  head: () => ({
    meta: [
      { title: "Layouts de Importação | Motor de Layouts" },
      {
        name: "description",
        content:
          "Cadastre, versione e mantenha os modelos de planilha usados nas importações do sistema.",
      },
      { property: "og:title", content: "Layouts de Importação" },
      {
        property: "og:description",
        content: "Motor de Layouts: mapeamento por sinônimos, validação e versionamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LayoutsPage,
});

const TIPOS_DADO = ["texto", "numero", "moeda", "data", "cpf", "competencia"];

type LayoutRow = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  modulo: string;
  ativo: boolean;
  classificacao?: string | null;
  versao_atual: number;

  qtd_campos: number;
  updated_at: string;
};

type EditorState = {
  aberto: boolean;
  somenteLeitura: boolean;
  layout_id: string | null;
  codigo: string;
  nome: string;
  descricao: string;
  tipo: string;
  modulo: string;
  notas: string;
  arquivoHints: string;
  headerHints: string;
  campos: LayoutCampo[];
};

const VAZIO: EditorState = {
  aberto: false,
  somenteLeitura: false,
  layout_id: null,
  codigo: "",
  nome: "",
  descricao: "",
  tipo: "planilha",
  modulo: "geral",
  notas: "",
  arquivoHints: "",
  headerHints: "",
  campos: [],
};

function LayoutsPage() {
  const qc = useQueryClient();
  const [modulo, setModulo] = useState<string>("__todos__");
  const [incluirInativos, setIncluirInativos] = useState(true);
  const [ed, setEd] = useState<EditorState>(VAZIO);
  const fileRef = useRef<HTMLInputElement>(null);


  const layoutsQ = useQuery({
    queryKey: ["layouts", modulo, incluirInativos],
    queryFn: () =>
      listLayouts({
        data: { modulo: modulo === "__todos__" ? null : modulo, incluirInativos },
      }),
  });

  const usoQ = useQuery({
    queryKey: ["layouts", "uso"],
    queryFn: () => listUsoLayouts({ data: { limit: 100 } }),
  });

  const moduloFiltro = modulo === "__todos__" ? null : modulo;

  const sugestoesQ = useQuery({
    queryKey: ["layouts", "sugestoes", moduloFiltro],
    queryFn: () => listSugestoesAlias({ data: { modulo: moduloFiltro } }),
  });

  const aliasesQ = useQuery({
    queryKey: ["layouts", "aliases", moduloFiltro],
    queryFn: () => listHistoricoAliases({ data: { modulo: moduloFiltro } }),
  });

  const statsQ = useQuery({
    queryKey: ["layouts", "stats", moduloFiltro],
    queryFn: () => estatisticasLayouts({ data: { modulo: moduloFiltro } }),
  });

  const resolverMut = useMutation({
    mutationFn: (v: { id: string; status: "aceita" | "rejeitada" }) =>
      resolverSugestaoAlias({ data: v }),
    onSuccess: () => {
      toast.success("Sugestão atualizada.");
      void qc.invalidateQueries({ queryKey: ["layouts"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });

  const aliasMut = useMutation({
    mutationFn: (v: { id: string; peso?: number; ativo?: boolean }) =>
      atualizarAliasCatalogo({ data: v }),
    onSuccess: () => {
      toast.success("Sinônimo atualizado.");
      void qc.invalidateQueries({ queryKey: ["layouts"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao atualizar"),
  });


  const layouts = (layoutsQ.data?.layouts ?? []) as LayoutRow[];
  const modulos = useMemo(
    () => Array.from(new Set(layouts.map((l) => l.modulo))).sort(),
    [layouts],
  );

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["layouts"] });

  async function abrir(layout_id: string, somenteLeitura: boolean) {
    const res = await getLayout({ data: { layout_id } });
    setEd({
      aberto: true,
      somenteLeitura,
      layout_id,
      codigo: res.layout.codigo,
      nome: res.layout.nome,
      descricao: res.layout.descricao ?? "",
      tipo: res.layout.tipo,
      modulo: res.layout.modulo,
      notas: "",
      arquivoHints: (res.versao?.arquivo_hints ?? []).join(", "),
      headerHints: (res.versao?.header_hints ?? []).join(", "),
      campos: res.campos,
    });
  }

  const salvarMut = useMutation({
    mutationFn: async () => {
      const payload = {
        arquivo_hints: ed.arquivoHints.split(",").map((s) => s.trim()).filter(Boolean),
        header_hints: ed.headerHints.split(",").map((s) => s.trim()).filter(Boolean),
        notas: ed.notas || null,
        campos: ed.campos.map((c, i) => ({ ...c, ordem: i })),
      };
      if (ed.layout_id) {
        const r = await criarNovaVersao({
          data: {
            layout_id: ed.layout_id,
            nome: ed.nome,
            descricao: ed.descricao || null,
            ...payload,
          },
        });
        return `Nova versão ${r.versao} criada.`;
      }
      await criarLayout({
        data: {
          codigo: ed.codigo,
          nome: ed.nome,
          descricao: ed.descricao || null,
          tipo: ed.tipo,
          modulo: ed.modulo,
          ...payload,
        },
      });
      return "Layout criado na versão 1.";
    },
    onSuccess: (msg) => {
      toast.success(msg);
      setEd(VAZIO);
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar o layout"),
  });

  const duplicarMut = useMutation({
    mutationFn: (l: LayoutRow) =>
      duplicarLayout({
        data: { layout_id: l.id, codigo: `${l.codigo}-copia`, nome: `${l.nome} (cópia)` },
      }),
    onSuccess: () => {
      toast.success("Layout duplicado.");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao duplicar"),
  });

  const situacaoMut = useMutation({
    mutationFn: (l: LayoutRow) =>
      alterarSituacaoLayout({ data: { layout_id: l.id, ativo: !l.ativo } }),
    onSuccess: () => {
      toast.success("Situação atualizada.");
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao alterar"),
  });

  const classificacaoMut = useMutation({
    mutationFn: (v: { layout_id: string; classificacao: string }) =>
      definirClassificacaoLayout({ data: v as any }),
    onSuccess: () => {
      toast.success("Classificação atualizada.");
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao classificar o layout"),
  });

  /** Exporta o layout (versão atual) como pacote JSON para a biblioteca compartilhada. */
  async function baixarPacote(l: LayoutRow) {
    try {
      const pacote = await exportarLayout({ data: { layout_id: l.id } });
      const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeArquivoPacote(l.codigo, pacote.versao.versao);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao exportar o layout");
    }
  }

  const importarMut = useMutation({
    mutationFn: async (file: File) => {
      const texto = await file.text();
      return importarLayoutPacote({ data: { pacote: JSON.parse(texto) } });
    },
    onSuccess: (r) => {
      toast.success(`Layout importado como "${r.codigo}".`);
      invalidate();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Arquivo de layout inválido"),
  });


  const cols: DataTableColumn<LayoutRow>[] = [
    { key: "nome", header: "Nome", cell: (l) => <span className="font-medium">{l.nome}</span> },
    { key: "codigo", header: "Código", cell: (l) => <code className="text-xs">{l.codigo}</code> },
    { key: "modulo", header: "Módulo", cell: (l) => <Badge variant="outline">{l.modulo}</Badge> },
    { key: "tipo", header: "Tipo", cell: (l) => l.tipo },
    { key: "versao", header: "Versão", cell: (l) => `v${l.versao_atual}` },
    {
      key: "status",
      header: "Status",
      cell: (l) => (
        <Badge variant={l.ativo ? "default" : "secondary"}>{l.ativo ? "Ativo" : "Inativo"}</Badge>
      ),
    },
    {
      key: "classificacao",
      header: "Biblioteca",
      cell: (l) => (
        <Select
          value={classificacaoValida(l.classificacao)}
          onValueChange={(v) => classificacaoMut.mutate({ layout_id: l.id, classificacao: v })}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CLASSIFICACOES.map((c) => (
              <SelectItem key={c} value={c}>
                {LABEL_CLASSIFICACAO[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    { key: "campos", header: "Campos", cell: (l) => l.qtd_campos },
    {
      key: "alterado",
      header: "Última alteração",
      cell: (l) => new Date(l.updated_at).toLocaleString("pt-BR"),
    },
    {
      key: "acoes",
      header: "Ações",
      cell: (l) => (
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={() => void abrir(l.id, true)} title="Visualizar">
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => void baixarPacote(l)}
            title="Exportar layout (JSON)"
          >
            <Download className="h-4 w-4" />
          </Button>
          <PermissionGate permission="configuracao.editar">
            <Button size="icon" variant="ghost" onClick={() => void abrir(l.id, false)} title="Editar">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => duplicarMut.mutate(l)} title="Duplicar">
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => situacaoMut.mutate(l)}
              title={l.ativo ? "Desativar" : "Ativar"}
            >
              <Power className="h-4 w-4" />
            </Button>
          </PermissionGate>
        </div>
      ),

    },
  ];

  const setCampo = (i: number, patch: Partial<LayoutCampo>) =>
    setEd((s) => ({
      ...s,
      campos: s.campos.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Layouts de Importação"
        description="Motor de Layouts: modelos de planilha configuráveis, com sinônimos, campos obrigatórios, validação e versionamento — reutilizável por todos os módulos."
        actions={
          <PermissionGate permission="configuracao.editar">
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) importarMut.mutate(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={importarMut.isPending}
              >
                <Upload className="mr-2 h-4 w-4" /> Importar (JSON)
              </Button>
              <Button onClick={() => setEd({ ...VAZIO, aberto: true })}>
                <Plus className="mr-2 h-4 w-4" /> Novo layout
              </Button>
            </div>
          </PermissionGate>
        }
      />

      <Tabs defaultValue="layouts">
        <TabsList>
          <TabsTrigger value="layouts">Layouts</TabsTrigger>
          <TabsTrigger value="sinonimos">Sinônimos</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="uso">Utilização</TabsTrigger>
        </TabsList>


        <TabsContent value="layouts" className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Label className="text-xs">Módulo</Label>
              <Select value={modulo} onValueChange={setModulo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__todos__">Todos os módulos</SelectItem>
                  {modulos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <Checkbox
                checked={incluirInativos}
                onCheckedChange={(v) => setIncluirInativos(v === true)}
              />
              Exibir inativos
            </label>
          </div>

          <DataTable
            columns={cols}
            rows={layouts}
            getRowKey={(l) => l.id}
            loading={layoutsQ.isLoading}
            emptyTitle="Nenhum layout cadastrado"
            emptyDescription="Crie o primeiro modelo de planilha."
          />
        </TabsContent>

        <TabsContent value="sinonimos" className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              Sugestões de sinônimos (3 confirmações promovem ao catálogo)
            </h3>
            <DataTable
              columns={[
                { key: "campo", header: "Campo", cell: (s: any) => labelCampoInterno(s.campo_interno) },
                { key: "alias", header: "Cabeçalho", cell: (s: any) => <code className="text-xs">{s.alias}</code> },
                { key: "modulo", header: "Módulo", cell: (s: any) => <Badge variant="outline">{s.modulo}</Badge> },
                { key: "origem", header: "Origem", cell: (s: any) => s.origem },
                {
                  key: "conf",
                  header: "Confirmações",
                  cell: (s: any) => `${s.confirmacoes}/3`,
                },
                {
                  key: "status",
                  header: "Situação",
                  cell: (s: any) => (
                    <Badge variant={s.status === "aceita" ? "default" : "secondary"}>{s.status}</Badge>
                  ),
                },
                {
                  key: "acoes",
                  header: "Ações",
                  cell: (s: any) => (
                    <PermissionGate permission="configuracao.editar">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Aceitar sugestão"
                          onClick={() => resolverMut.mutate({ id: s.id, status: "aceita" })}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Rejeitar sugestão"
                          onClick={() => resolverMut.mutate({ id: s.id, status: "rejeitada" })}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </PermissionGate>
                  ),
                },
              ]}
              rows={(sugestoesQ.data?.sugestoes ?? []) as any[]}
              getRowKey={(s: any) => s.id}
              loading={sugestoesQ.isLoading}
              emptyTitle="Nenhuma sugestão"
              emptyDescription="Os cabeçalhos mapeados manualmente aparecem aqui até serem confirmados."
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold">Catálogo de sinônimos (histórico)</h3>
            <DataTable
              columns={[
                { key: "campo", header: "Campo", cell: (a: any) => labelCampoInterno(a.campo_interno) },
                { key: "alias", header: "Sinônimo", cell: (a: any) => <code className="text-xs">{a.alias}</code> },
                { key: "modulo", header: "Módulo", cell: (a: any) => <Badge variant="outline">{a.modulo}</Badge> },
                {
                  key: "peso",
                  header: "Peso",
                  cell: (a: any) => (
                    <PesoInput
                      valor={a.peso}
                      onSalvar={(peso) => aliasMut.mutate({ id: a.id, peso })}
                    />
                  ),
                },
                { key: "origem", header: "Origem", cell: (a: any) => a.origem },
                { key: "criador", header: "Criado por", cell: (a: any) => a.criado_por_nome },
                { key: "usos", header: "Usos", cell: (a: any) => a.usos ?? 0 },
                {
                  key: "ultimo",
                  header: "Último uso",
                  cell: (a: any) =>
                    a.ultimo_uso ? new Date(a.ultimo_uso).toLocaleDateString("pt-BR") : "—",
                },
                {
                  key: "ativo",
                  header: "Situação",
                  cell: (a: any) => (
                    <PermissionGate
                      permission="configuracao.editar"
                      fallback={<Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Inativo"}</Badge>}
                    >
                      <Button
                        size="sm"
                        variant={a.ativo ? "default" : "secondary"}
                        onClick={() => aliasMut.mutate({ id: a.id, ativo: !a.ativo })}
                      >
                        {a.ativo ? "Ativo" : "Inativo"}
                      </Button>
                    </PermissionGate>
                  ),
                },
              ]}
              rows={(aliasesQ.data?.aliases ?? []) as any[]}
              getRowKey={(a: any) => a.id}
              loading={aliasesQ.isLoading}
              emptyTitle="Catálogo vazio"
              emptyDescription="Nenhum sinônimo registrado no catálogo global."
            />
          </div>
        </TabsContent>

        <TabsContent value="estatisticas" className="space-y-4">
          {statsQ.isLoading || !statsQ.data ? (
            <p className="text-sm text-muted-foreground">Carregando estatísticas…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { t: "Layouts ativos", v: `${statsQ.data.layouts_ativos}/${statsQ.data.layouts}` },
                  {
                    t: "Reconhecimento médio",
                    v: statsQ.data.taxa_reconhecimento === null ? "—" : `${statsQ.data.taxa_reconhecimento}%`,
                  },
                  {
                    t: "Mapeamento manual",
                    v: statsQ.data.taxa_manual === null ? "—" : `${statsQ.data.taxa_manual}%`,
                  },
                  { t: "Importações registradas", v: statsQ.data.importacoes },
                  { t: "Sinônimos no catálogo", v: statsQ.data.aliases_catalogo },
                  { t: "Sinônimos aprendidos", v: statsQ.data.aliases_aprendidos },
                  { t: "Sugestões pendentes", v: statsQ.data.sugestoes_pendentes },
                  { t: "Campos condicionais", v: statsQ.data.campos_condicionais },
                ].map((k) => (
                  <Card key={k.t}>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">{k.t}</p>
                      <p className="text-2xl font-semibold">{k.v}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Layouts mais utilizados</h3>
                  <DataTable
                    columns={[
                      { key: "codigo", header: "Layout", cell: (r: any) => r.codigo },
                      { key: "usos", header: "Importações", cell: (r: any) => r.usos },
                    ]}
                    rows={statsQ.data.mais_utilizados as any[]}
                    getRowKey={(r: any) => r.codigo}
                    emptyTitle="Sem dados"
                    emptyDescription="Nenhuma importação registrada."
                  />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Campos que mais exigem ajuste manual</h3>
                  <DataTable
                    columns={[
                      { key: "campo", header: "Campo", cell: (r: any) => labelCampoInterno(r.campo) },
                      { key: "qtd", header: "Ocorrências", cell: (r: any) => r.qtd },
                    ]}
                    rows={statsQ.data.campos_dificeis as any[]}
                    getRowKey={(r: any) => r.campo}
                    emptyTitle="Sem dados"
                    emptyDescription="Nenhum cabeçalho desconhecido mapeado até o momento."
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>


        <TabsContent value="uso">
          <DataTable
            columns={[
              {
                key: "data",
                header: "Data",
                cell: (u: any) => new Date(u.created_at).toLocaleString("pt-BR"),
              },
              { key: "layout", header: "Layout", cell: (u: any) => u.layout_codigo ?? "—" },
              { key: "versao", header: "Versão", cell: (u: any) => (u.versao ? `v${u.versao}` : "—") },
              { key: "modulo", header: "Módulo", cell: (u: any) => u.modulo },
              { key: "arquivo", header: "Arquivo", cell: (u: any) => u.nome_arquivo ?? "—" },
              { key: "comp", header: "Competência", cell: (u: any) => u.competencia ?? "—" },
              { key: "linhas", header: "Linhas", cell: (u: any) => u.total_linhas },
              {
                key: "tempo",
                header: "Tempo",
                cell: (u: any) => (u.duracao_ms ? `${(u.duracao_ms / 1000).toFixed(1)}s` : "—"),
              },
            ]}
            rows={(usoQ.data?.usos ?? []) as any[]}
            getRowKey={(u: any) => u.id}
            loading={usoQ.isLoading}
            emptyTitle="Sem utilizações"
            emptyDescription="Nenhuma importação registrada pelo motor até o momento."
          />
        </TabsContent>
      </Tabs>

      <Dialog open={ed.aberto} onOpenChange={(o) => !o && setEd(VAZIO)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {ed.somenteLeitura
                ? "Visualizar layout"
                : ed.layout_id
                  ? "Editar layout (gera nova versão)"
                  : "Novo layout"}
            </DialogTitle>
            <DialogDescription>
              Cada gravação cria uma nova versão; as importações anteriores permanecem vinculadas à
              versão utilizada.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={ed.somenteLeitura} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={ed.nome} onChange={(e) => setEd((s) => ({ ...s, nome: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Código interno</Label>
                <Input
                  value={ed.codigo}
                  disabled={!!ed.layout_id}
                  onChange={(e) => setEd((s) => ({ ...s, codigo: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Input value={ed.tipo} onChange={(e) => setEd((s) => ({ ...s, tipo: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Módulo</Label>
                <Input
                  value={ed.modulo}
                  disabled={!!ed.layout_id}
                  onChange={(e) => setEd((s) => ({ ...s, modulo: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Descrição</Label>
                <Textarea
                  rows={2}
                  value={ed.descricao}
                  onChange={(e) => setEd((s) => ({ ...s, descricao: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Pistas no nome do arquivo (separadas por vírgula)</Label>
                <Input
                  value={ed.arquivoHints}
                  onChange={(e) => setEd((s) => ({ ...s, arquivoHints: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Pistas nos cabeçalhos (separadas por vírgula)</Label>
                <Input
                  value={ed.headerHints}
                  onChange={(e) => setEd((s) => ({ ...s, headerHints: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Notas desta versão</Label>
                <Input value={ed.notas} onChange={(e) => setEd((s) => ({ ...s, notas: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Campos do layout ({ed.campos.length})</h3>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setEd((s) => ({
                      ...s,
                      campos: [
                        ...s.campos,
                        {
                          campo_interno: "",
                          label: "",
                          coluna_padrao: "",
                          aliases: [],
                          obrigatorio: false,
                          condicional: false,
                          ignorado: false,
                          tipo_dado: "texto",
                          pesos: {},
                          ordem: s.campos.length,

                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-2 h-4 w-4" /> Adicionar campo
                </Button>
              </div>

              <div className="space-y-2">
                {ed.campos.map((c, i) => (
                  <div key={i} className="grid gap-2 rounded-md border p-2 md:grid-cols-12">
                    <div className="space-y-1 md:col-span-2">
                      <Select
                        value={campoCatalogo(c.campo_interno) ? c.campo_interno : "__custom"}
                        onValueChange={(v) => {
                          if (v === "__custom") {
                            setCampo(i, { campo_interno: "" });
                            return;
                          }
                          const cat = campoCatalogo(v);
                          setCampo(i, {
                            campo_interno: v,
                            label: c.label ? c.label : (cat?.label ?? v),
                            tipo_dado: cat?.tipo_dado ?? c.tipo_dado,
                            aliases: c.aliases.length ? c.aliases : (cat?.aliases ?? []),
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Campo interno" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          <SelectItem value="__custom">Personalizado…</SelectItem>
                          {camposPorGrupo().map((g) => (
                            <SelectGroup key={g.grupo}>
                              <SelectLabel>{g.grupo}</SelectLabel>
                              {g.campos.map((cc) => (
                                <SelectItem key={cc.key} value={cc.key}>
                                  {cc.label}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                        </SelectContent>
                      </Select>
                      {!campoCatalogo(c.campo_interno) && (
                        <Input
                          placeholder="campo_interno"
                          value={c.campo_interno}
                          onChange={(e) => setCampo(i, { campo_interno: e.target.value })}
                        />
                      )}
                    </div>

                    <Input
                      className="md:col-span-2"
                      placeholder="Rótulo"
                      value={c.label ?? ""}
                      onChange={(e) => setCampo(i, { label: e.target.value })}
                    />
                    <Input
                      className="md:col-span-2"
                      placeholder="Coluna da planilha"
                      value={c.coluna_padrao ?? ""}
                      onChange={(e) => setCampo(i, { coluna_padrao: e.target.value })}
                    />
                    <Input
                      className="md:col-span-2"
                      placeholder="Sinônimos (vírgula)"
                      value={c.aliases.join(", ")}
                      onChange={(e) =>
                        setCampo(i, {
                          aliases: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                        })
                      }
                    />
                    <Select value={String(c.tipo_dado)} onValueChange={(v) => setCampo(i, { tipo_dado: v })}>
                      <SelectTrigger className="md:col-span-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIPOS_DADO.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={estadoObrigatoriedade(c)}
                      onValueChange={(v) =>
                        setCampo(i, aplicarObrigatoriedade(v as EstadoObrigatoriedade))
                      }
                    >
                      <SelectTrigger className="md:col-span-2" title="Obrigatoriedade do campo">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["obrigatorio", "condicional", "opcional"] as EstadoObrigatoriedade[]).map(
                          (e) => (
                            <SelectItem key={e} value={e}>
                              {LABEL_OBRIGATORIEDADE[e]}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2 md:col-span-1">
                      <label className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={c.ignorado}
                          onCheckedChange={(v) => setCampo(i, { ignorado: v === true })}
                        />
                        Ignorar
                      </label>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setEd((s) => ({ ...s, campos: s.campos.filter((_, idx) => idx !== i) }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                  </div>
                ))}
                {ed.campos.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum campo definido. Adicione os campos internos e os sinônimos das colunas.
                  </p>
                )}
              </div>
            </div>
          </fieldset>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEd(VAZIO)}>
              Fechar
            </Button>
            {!ed.somenteLeitura && (
              <Button onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
                {ed.layout_id ? "Salvar nova versão" : "Criar layout"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Edição rápida do peso de um sinônimo (0..100). */
function PesoInput({ valor, onSalvar }: { valor: number; onSalvar: (peso: number) => void }) {
  const [v, setV] = useState(String(valor ?? 0));
  return (
    <Input
      className="h-8 w-20 text-xs"
      type="number"
      min={0}
      max={100}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
        setV(String(n));
        if (n !== valor) onSalvar(n);
      }}
    />
  );
}
