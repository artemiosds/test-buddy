import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { PenLine, Upload, Trash2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import {
  SignatureEditor,
  DEFAULT_POSITION,
  type SignaturePosition,
} from "@/components/assinaturas/signature-editor";

export const Route = createFileRoute("/_authenticated/meu-perfil/assinatura")({
  component: MinhaAssinaturaPage,
});

const BUCKET = "assinaturas";
const PERFIS_ELEGIVEIS = ["MASTER", "GESTOR", "GESTAO", "DIRETOR", "DIRETOR_UNIDADE", "COORDENADOR"];

type Unidade = { id: string; nome: string };
type Assinatura = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  unidade_id: string | null;
  titular_nome: string;
  titular_cargo: string | null;
  ativa: boolean;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  created_at: string;
  posicao_x: number | null;
  posicao_y: number | null;
  tamanho_percentual: number | null;
  alinhamento: string | null;
  mostrar_nome: boolean | null;
  mostrar_cargo: boolean | null;
};

function MinhaAssinaturaPage() {
  const { data: me, isLoading: loadingMe } = useCurrentUser();
  const qc = useQueryClient();

  const elegivel = !!me && PERFIS_ELEGIVEIS.includes((me.perfil_codigo || "").toUpperCase());

  // Unidades do usuário
  const { data: unidades } = useQuery({
    queryKey: ["minhas-unidades", me?.id],
    enabled: !!me?.id,
    queryFn: async (): Promise<Unidade[]> => {
      const { data, error } = await supabase
        .from("usuario_unidades")
        .select("unidade_id, unidades:unidade_id(id, nome)")
        .eq("usuario_id", me!.id)
        .is("deleted_at", null);
      if (error) throw error;
      const list: Unidade[] = [];
      for (const r of (data ?? []) as Array<{ unidades: Unidade | null }>) {
        if (r.unidades) list.push(r.unidades);
      }
      return list;
    },
  });

  // Minhas assinaturas pessoais
  const { data: minhas, isLoading } = useQuery({
    queryKey: ["minhas-assinaturas", me?.id],
    enabled: !!me?.id,
    queryFn: async (): Promise<Assinatura[]> => {
      const { data, error } = await supabase
        .from("assinaturas_institucionais")
        .select("id, storage_path, mime_type, unidade_id, titular_nome, titular_cargo, ativa, vigencia_inicio, vigencia_fim, created_at, posicao_x, posicao_y, tamanho_percentual, alinhamento, mostrar_nome, mostrar_cargo")
        .eq("usuario_id", me!.id)
        .eq("is_pessoal", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Assinatura[];
    },
  });

  const toggleAtiva = useMutation({
    mutationFn: async ({ id, ativa }: { id: string; ativa: boolean }) => {
      const { error } = await supabase
        .from("assinaturas_institucionais")
        .update({ ativa })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura atualizada");
      qc.invalidateQueries({ queryKey: ["minhas-assinaturas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao atualizar"),
  });

  const excluir = useMutation({
    mutationFn: async (row: Assinatura) => {
      const { error } = await supabase
        .from("assinaturas_institucionais")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    },
    onSuccess: () => {
      toast.success("Assinatura removida");
      qc.invalidateQueries({ queryKey: ["minhas-assinaturas"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao remover"),
  });

  if (loadingMe) return <div className="text-sm text-muted-foreground">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <PenLine className="h-6 w-6 text-primary" /> Minha assinatura digital
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre sua assinatura para que documentos oficiais possam ser assinados automaticamente pelo sistema.
          </p>
        </div>
      </div>

      {!elegivel && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Seu perfil não requer assinatura pessoal</AlertTitle>
          <AlertDescription>
            Somente Diretores, Coordenadores, Gestores e Master têm assinatura pessoal vinculada aos documentos.
            Se você entende que deveria ter, procure o administrador do sistema.
          </AlertDescription>
        </Alert>
      )}

      {elegivel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Nova assinatura</CardTitle>
              <CardDescription>Envie um arquivo PNG ou JPG. Recomendamos PNG com fundo transparente.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadForm
                me={me!}
                unidades={unidades ?? []}
                onSaved={() => qc.invalidateQueries({ queryKey: ["minhas-assinaturas"] })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Minhas assinaturas</CardTitle>
              <CardDescription>
                Apenas uma assinatura pode estar ativa por unidade. Ativar uma nova desativa a anterior automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando…</div>
              ) : (minhas ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Você ainda não cadastrou nenhuma assinatura.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {(minhas ?? []).map((row) => (
                    <AssinaturaCard
                      key={row.id}
                      row={row}
                      unidades={unidades ?? []}
                      onToggle={(ativa) => toggleAtiva.mutate({ id: row.id, ativa })}
                      onDelete={() => {
                        if (confirm("Remover esta assinatura?")) excluir.mutate(row);
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function UploadForm({
  me, unidades, onSaved,
}: {
  me: { id: string; nome_completo?: string | null; perfil_id?: string | null };
  unidades: Unidade[];
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [titularNome, setTitularNome] = useState(me.nome_completo ?? "");
  const [titularCargo, setTitularCargo] = useState("");
  const [unidadeId, setUnidadeId] = useState<string>(unidades[0]?.id ?? "__todas__");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function salvar() {
    if (!file) { toast.error("Selecione um arquivo PNG ou JPG"); return; }
    if (!/^image\/(png|jpe?g)$/i.test(file.type)) { toast.error("Formato inválido. Use PNG ou JPG"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande. Máx: 2MB"); return; }
    if (!titularNome.trim()) { toast.error("Informe seu nome completo"); return; }

    setSaving(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const unidSeg = unidadeId === "__todas__" ? "todas" : unidadeId;
      const path = `pessoal/${me.id}/${unidSeg}/${crypto.randomUUID()}.${ext}`;

      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (up.error) throw up.error;

      const unidadeReal = unidadeId === "__todas__" ? null : unidadeId;
      const ins = await supabase.from("assinaturas_institucionais").insert({
        tipo: "assinatura",
        titular_nome: titularNome.trim(),
        titular_cargo: titularCargo.trim() || null,
        storage_path: path,
        mime_type: file.type,
        usuario_id: me.id,
        unidade_id: unidadeReal,
        secretaria_id: null,
        perfil_id: me.perfil_id ?? null,
        is_pessoal: true,
        ativa: true,
        obrigatoria: false,
        ordem: 1,
        tipos_documento: [],
        vigencia_fim: vigenciaFim || null,
        created_by: me.id,
      });
      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      toast.success("Assinatura cadastrada com sucesso");
      setFile(null);
      setTitularCargo("");
      setVigenciaFim("");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-3">
        <div>
          <Label htmlFor="file">Arquivo (PNG/JPG, máx 2MB)</Label>
          <Input
            id="file"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label htmlFor="nome">Nome completo (como assina)</Label>
          <Input id="nome" value={titularNome} onChange={(e) => setTitularNome(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="cargo">Cargo / função</Label>
          <Input
            id="cargo"
            value={titularCargo}
            onChange={(e) => setTitularCargo(e.target.value)}
            placeholder="Ex.: Diretor da UBS Central"
          />
        </div>
        <div>
          <Label htmlFor="unidade">Unidade</Label>
          <Select value={unidadeId} onValueChange={setUnidadeId}>
            <SelectTrigger id="unidade"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas as minhas unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {unidades.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              Você não está vinculado a nenhuma unidade. A assinatura ficará como "todas".
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="fim">Vigência até (opcional)</Label>
          <Input id="fim" type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
        </div>
        <Button onClick={salvar} disabled={saving || !file} className="w-full">
          <Upload className="mr-2 h-4 w-4" />
          {saving ? "Enviando…" : "Cadastrar assinatura"}
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Pré-visualização</Label>
        <div className="border rounded-lg p-4 bg-muted/30 min-h-[220px] flex items-center justify-center">
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-[200px] object-contain" />
          ) : (
            <span className="text-sm text-muted-foreground">Selecione um arquivo para visualizar</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Dica: fotografe a assinatura em papel branco e remova o fundo para PNG transparente.
        </p>
      </div>
    </div>
  );
}

function AssinaturaCard({
  row, unidades, onToggle, onDelete,
}: {
  row: Assinatura;
  unidades: Unidade[];
  onToggle: (ativa: boolean) => void;
  onDelete: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
      if (!cancel) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { cancel = true; };
  }, [row.storage_path]);

  const unidadeNome = row.unidade_id
    ? unidades.find((u) => u.id === row.unidade_id)?.nome ?? "Unidade removida"
    : "Todas as unidades";

  const vencida = row.vigencia_fim && new Date(row.vigencia_fim) < new Date();

  return (
    <div className="border rounded-lg p-4 space-y-3 bg-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{row.titular_nome}</div>
          {row.titular_cargo && (
            <div className="text-xs text-muted-foreground">{row.titular_cargo}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">{unidadeNome}</div>
        </div>
        <div className="flex items-center gap-1">
          {row.ativa ? (
            <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Ativa</Badge>
          ) : (
            <Badge variant="secondary">Inativa</Badge>
          )}
          {vencida && <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Vencida</Badge>}
        </div>
      </div>

      <div className="border rounded bg-muted/30 h-[100px] flex items-center justify-center overflow-hidden">
        {signedUrl ? (
          <img src={signedUrl} alt="Assinatura" className="max-h-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">Carregando…</span>
        )}
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div className="flex items-center gap-2">
          <Switch checked={row.ativa} onCheckedChange={onToggle} />
          <span className="text-xs text-muted-foreground">{row.ativa ? "Ativa" : "Ativar"}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {row.vigencia_fim && (
        <div className="text-xs text-muted-foreground">
          Vigente até: {new Date(row.vigencia_fim).toLocaleDateString("pt-BR")}
        </div>
      )}
    </div>
  );
}