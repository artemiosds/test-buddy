import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { PenLine, Upload, Trash2, AlertCircle, CheckCircle2, Info, MousePointer2, ShieldCheck, Hash } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import {
  SignatureEditor,
  DEFAULT_POSITION,
  type SignaturePosition,
} from "@/components/assinaturas/signature-editor";
import { SignaturePad } from "@/components/assinaturas/signature-pad";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateInstitutionalHash, saveInstitutionalSignature } from "@/lib/assinaturas-institucionais.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/meu-perfil/assinatura")({ errorComponent: ErrorComponent,
  // Redirecionamento removido para permitir edição direta
});

const BUCKET = "assinaturas";
const PERFIS_ELEGIVEIS = [
  "MASTER",
  "GESTOR",
  "GESTAO",
  "DIRETOR",
  "DIRETOR_UNIDADE",
  "COORDENADOR",
];

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

export function MinhaAssinaturaPage() {
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
        .select(
          "id, storage_path, mime_type, unidade_id, titular_nome, titular_cargo, ativa, vigencia_inicio, vigencia_fim, created_at, posicao_x, posicao_y, tamanho_percentual, alinhamento, mostrar_nome, mostrar_cargo",
        )
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
      const { data: me } = await supabase.auth.getUser();
      const userId = me.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase.from("assinaturas_institucionais").delete().eq("id", row.id);
      if (error) throw error;
      
      const fullPath = row.storage_path.includes('/') ? row.storage_path : `${userId}/${row.storage_path}`;
      await supabase.storage.from(BUCKET).remove([fullPath]);
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
            Cadastre sua assinatura para que documentos oficiais possam ser assinados
            automaticamente pelo sistema.
          </p>
        </div>
      </div>

      {!elegivel && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Seu perfil não requer assinatura pessoal</AlertTitle>
          <AlertDescription>
            Somente Diretores, Coordenadores, Gestores e Master têm assinatura pessoal vinculada aos
            documentos. Se você entende que deveria ter, procure o administrador do sistema.
          </AlertDescription>
        </Alert>
      )}

      {elegivel && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Nova assinatura</CardTitle>
              <CardDescription>
                Envie um arquivo PNG ou JPG. Recomendamos PNG com fundo transparente.
              </CardDescription>
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
                Apenas uma assinatura pode estar ativa por unidade. Ativar uma nova desativa a
                anterior automaticamente.
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
                      userId={me?.id}
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
  me,
  unidades,
  onSaved,
}: {
  me: { id: string; nome_completo?: string | null; perfil_id?: string | null; matricula?: string | null; cpf?: string | null };
  unidades: Unidade[];
  onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [padBlob, setPadBlob] = useState<Blob | null>(null);
  const [mode, setMode] = useState<"upload" | "pad" | "institutional">("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [titularNome, setTitularNome] = useState(me.nome_completo ?? "");
  const [titularCargo, setTitularCargo] = useState("");
  const [unidadeId, setUnidadeId] = useState<string>(unidades[0]?.id ?? "__todas__");
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState<SignaturePosition>(DEFAULT_POSITION);

  // Estados para assinatura institucional
  const [instHash, setInstHash] = useState<string | null>(null);
  const [instTimestamp, setInstTimestamp] = useState<string | null>(null);
  const genHash = useServerFn(generateInstitutionalHash);
  const saveInst = useServerFn(saveInstitutionalSignature);

  useEffect(() => {
    if (mode === "upload") {
      if (!file) {
        setPreview(null);
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (mode === "pad") {
      if (!padBlob) {
        setPreview(null);
        return;
      }
      const url = URL.createObjectURL(padBlob);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (mode === "institutional") {
      setPreview(null);
    }
  }, [file, padBlob, mode]);

  async function processImage(file: File): Promise<{ blob: Blob; ext: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ blob: file, ext: file.name.split(".").pop()?.toLowerCase() ?? "png" });
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Limiar para considerar um pixel como "branco/claro"
        // 240/255 é um bom equilíbrio para remover fundos não perfeitamente brancos
        const threshold = 240;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Se as 3 cores estão acima do limiar, torna o pixel transparente
          if (r > threshold && g > threshold && b > threshold) {
            data[i + 3] = 0;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) resolve({ blob, ext: "png" });
          else resolve({ blob: file, ext: file.name.split(".").pop()?.toLowerCase() ?? "png" });
        }, "image/png");
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async function salvar() {
    if (mode === "institutional") {
      if (!instHash) {
        toast.error("Gere a assinatura institucional antes de salvar");
        return;
      }
      
      setSaving(true);
      try {
        const isUUID = (val: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ""));
        const validateId = (id: any, fieldName: string) => {
          if (!id) return null;
          const s = String(id);
          if (s.includes('.') || s.includes('/')) {
            throw new Error(`O campo ${fieldName} recebeu um valor de arquivo inválido como UUID: ${s}`);
          }
          if (!isUUID(s)) return null;
          return s;
        };

        const unidadeReal = unidadeId === "__todas__" ? null : unidadeId;
        const unidadeNome = unidades.find(u => u.id === unidadeReal)?.nome ?? "Todas as unidades";

        await saveInst({
          data: {
            usuario_id: validateId(me.id, 'usuario_id')!,
            perfil_id: validateId(me.perfil_id, 'perfil_id'),
            unidade_id: validateId(unidadeReal, 'unidade_id'),
            secretaria_id: null,
            titular_nome: titularNome.trim(),
            titular_cargo: titularCargo.trim() || null,
            hash: instHash,
            metadata: {
              matricula: me.matricula,
              unidade_nome: unidadeNome,
              timestamp: instTimestamp,
              cpf_mascarado: me.cpf ? `${me.cpf.slice(0, 3)}.***.***-${me.cpf.slice(-2)}` : null
            }
          }
        });

        toast.success("Assinatura institucional cadastrada");
        setInstHash(null);
        setInstTimestamp(null);
        onSaved();
      } catch (e: any) {
        toast.error(e.message || "Erro ao salvar assinatura institucional");
      } finally {
        setSaving(false);
      }
      return;
    }

    const activeBlob = mode === "upload" ? file : padBlob;
    if (!activeBlob) {
      toast.error(mode === "upload" ? "Selecione um arquivo PNG ou JPG" : "Faça sua assinatura no quadro");
      return;
    }
    if (mode === "upload" && file && !/^image\/(png|jpe?g)$/i.test(file.type)) {
      toast.error("Formato inválido. Use PNG ou JPG");
      return;
    }
    if (activeBlob.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máx: 2MB");
      return;
    }
    if (!titularNome.trim()) {
      toast.error("Informe seu nome completo");
      return;
    }

    setSaving(true);
    try {
      const { blob: processedBlob, ext } = mode === "upload" && file 
        ? await processImage(file)
        : { blob: activeBlob, ext: "png" };
      
      // O path do storage deve ser limpo e utilizar IDs únicos
      // Evitamos strings textuais como "pessoal" no início do path se o bucket/política for restritivo
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const path = `${me.id}/${fileName}`;

      const up = await supabase.storage.from(BUCKET).upload(path, processedBlob, {
        contentType: "image/png",
        upsert: false,
      });
      if (up.error) throw up.error;

      const isUUID = (val: any) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || ""));
      const validateId = (id: any, fieldName: string) => {
        if (!id) return null;
        const s = String(id);
        if (s.includes('.') || s.includes('/')) {
          throw new Error(`O campo ${fieldName} recebeu um valor de arquivo inválido como UUID: ${s}`);
        }
        if (!isUUID(s)) return null;
        return s;
      };
      
      const unidadeReal = unidadeId === "__todas__" ? null : unidadeId;
      const payloadAssinatura = {
        tipo: "assinatura" as const,
        titular_nome: titularNome.trim(),
        titular_cargo: titularCargo.trim() || null,
        storage_path: fileName,
        mime_type: "image/png",
        usuario_id: validateId(me.id, 'usuario_id'),
        unidade_id: validateId(unidadeReal, 'unidade_id'),
        secretaria_id: null,
        perfil_id: validateId(me.perfil_id, 'perfil_id'),
        is_pessoal: true,
        ativa: true,
        obrigatoria: false,
        ordem: 1,
        tipos_documento: [],
        vigencia_fim: vigenciaFim || null,
        created_by: me.id,
        posicao_x: pos.posicao_x,
        posicao_y: pos.posicao_y,
        tamanho_percentual: pos.tamanho_percentual,
        alinhamento: pos.alinhamento,
        mostrar_nome: pos.mostrar_nome,
        mostrar_cargo: pos.mostrar_cargo,
      };

      console.log('DEBUG PAYLOAD ASSINATURA (MEU PERFIL):', JSON.stringify(payloadAssinatura, null, 2));

      const ins = await supabase.from("assinaturas_institucionais").insert(payloadAssinatura);

      if (ins.error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw ins.error;
      }
      toast.success("Assinatura cadastrada");
      setFile(null);
      setPadBlob(null);
      setTitularCargo("");
      setVigenciaFim("");
      setPos(DEFAULT_POSITION);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="pad" className="flex items-center gap-2">
              <MousePointer2 className="h-4 w-4" /> Desenhar
            </TabsTrigger>
            <TabsTrigger value="institutional" className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Institucional
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-3 pt-4">
            <div>
              <Label htmlFor="file">Arquivo (PNG/JPG, máx 2MB)</Label>
              <Input
                id="file"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </TabsContent>
          
          <TabsContent value="pad" className="pt-4">
            <SignaturePad onConfirm={(blob) => setPadBlob(blob)} />
            {padBlob && (
              <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Assinatura capturada com sucesso!
              </p>
            )}
          </TabsContent>

          <TabsContent value="institutional" className="pt-4 space-y-4">
            <div className="bg-slate-50 border rounded-lg p-6 space-y-4 font-mono text-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <ShieldCheck className="h-24 w-24" />
              </div>
              
              <div className="text-center border-b border-slate-200 pb-2 mb-4">
                <h3 className="font-bold text-slate-900 uppercase tracking-tighter">Assinatura Eletrônica Institucional</h3>
              </div>
              
              <div className="space-y-2 text-slate-700">
                <p><span className="text-slate-400">Nome:</span> {titularNome || me.nome_completo || '---'}</p>
                <p><span className="text-slate-400">Cargo:</span> {titularCargo || '---'}</p>
                <p><span className="text-slate-400">Matrícula:</span> {me.matricula || '---'}</p>
                <p><span className="text-slate-400">CPF:</span> {me.cpf ? `${me.cpf.slice(0, 3)}.***.***-${me.cpf.slice(-2)}` : '---'}</p>
                <p><span className="text-slate-400">Órgão:</span> {unidades.find(u => u.id === unidadeId)?.nome || 'Todas as Unidades'}</p>
                <p><span className="text-slate-400">Data/Hora:</span> {instTimestamp ? new Date(instTimestamp).toLocaleString('pt-BR') : '---'}</p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-dashed border-slate-300">
                <p className="text-[10px] text-slate-400 mb-1">Código de validação:</p>
                <div className="bg-white border border-slate-200 rounded p-2 text-center font-bold text-primary tracking-widest">
                  {instHash || '---- ---- ---- ----'}
                </div>
              </div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              className="w-full"
              onClick={async () => {
                const ts = new Date().toISOString();
                const res = await genHash({
                  data: {
                    usuario_id: me.id,
                    nome: titularNome || me.nome_completo || '',
                    cargo: titularCargo,
                    matricula: me.matricula || undefined,
                    unidade: unidades.find(u => u.id === unidadeId)?.nome,
                    timestamp: ts
                  }
                });
                setInstHash(res.hash);
                setInstTimestamp(ts);
              }}
            >
              <Hash className="mr-2 h-4 w-4" />
              Gerar Assinatura Institucional
            </Button>
          </TabsContent>
        </Tabs>

        <div className="space-y-3 border-t pt-4">
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
              <SelectTrigger id="unidade">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todas as minhas unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fim">Vigência até (opcional)</Label>
            <Input
              id="fim"
              type="date"
              value={vigenciaFim}
              onChange={(e) => setVigenciaFim(e.target.value)}
            />
          </div>
          <Button onClick={salvar} disabled={saving || (mode !== "institutional" && !file && !padBlob) || (mode === "institutional" && !instHash)} className="w-full">
            {mode === "institutional" ? <ShieldCheck className="mr-2 h-4 w-4" /> : <Upload className="mr-2 h-4 w-4" />}
            {saving ? "Processando…" : mode === "institutional" ? "Confirmar Assinatura Institucional" : "Cadastrar assinatura"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <SignatureEditor
          imageUrl={preview}
          value={pos}
          onChange={setPos}
          titularNome={titularNome}
          titularCargo={titularCargo}
        />
        <p className="text-xs text-muted-foreground">
          Arraste a assinatura para posicioná-la. Use os sliders ou os botões de alinhamento rápido.
        </p>
      </div>
    </div>
  );
}

function AssinaturaCard({
  row,
  unidades,
  onToggle,
  onDelete,
  userId,
}: {
  row: Assinatura;
  unidades: Unidade[];
  onToggle: (ativa: boolean) => void;
  onDelete: () => void;
  userId?: string;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState<SignaturePosition>({
    posicao_x: row.posicao_x,
    posicao_y: row.posicao_y,
    tamanho_percentual: row.tamanho_percentual ?? 80,
    alinhamento: (row.alinhamento as SignaturePosition["alinhamento"]) ?? "direita",
    mostrar_nome: row.mostrar_nome ?? true,
    mostrar_cargo: row.mostrar_cargo ?? true,
  });
  const [savingPos, setSavingPos] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const fullPath = row.storage_path.includes('/') ? row.storage_path : (userId ? `${userId}/${row.storage_path}` : row.storage_path);
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(fullPath, 600);
      if (!cancel) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => {
      cancel = true;
    };
  }, [row.storage_path, userId]);

  const unidadeNome = row.unidade_id
    ? (unidades.find((u) => u.id === row.unidade_id)?.nome ?? "Unidade removida")
    : "Todas as unidades";

  const vencida = row.vigencia_fim && new Date(row.vigencia_fim) < new Date();

  async function salvarPosicao() {
    setSavingPos(true);
    try {
      const { error } = await supabase
        .from("assinaturas_institucionais")
        .update({
          posicao_x: pos.posicao_x,
          posicao_y: pos.posicao_y,
          tamanho_percentual: pos.tamanho_percentual,
          alinhamento: pos.alinhamento,
          mostrar_nome: pos.mostrar_nome,
          mostrar_cargo: pos.mostrar_cargo,
        })
        .eq("id", row.id);
      if (error) throw error;
      toast.success("Posição salva");
      setEditing(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingPos(false);
    }
  }

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
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Ativa
            </Badge>
          ) : (
            <Badge variant="secondary">Inativa</Badge>
          )}
          {vencida && (
            <Badge variant="destructive" className="gap-1">
              <AlertCircle className="h-3 w-3" />
              Vencida
            </Badge>
          )}
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

      <div className="pt-2 border-t">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "Fechar editor" : "Editar posicionamento"}
        </Button>
        {editing && (
          <div className="mt-3 space-y-3">
            <SignatureEditor
              imageUrl={signedUrl}
              value={pos}
              onChange={setPos}
              titularNome={row.titular_nome}
              titularCargo={row.titular_cargo ?? undefined}
            />
            <Button size="sm" className="w-full" onClick={salvarPosicao} disabled={savingPos}>
              {savingPos ? "Salvando…" : "Salvar posicionamento"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
