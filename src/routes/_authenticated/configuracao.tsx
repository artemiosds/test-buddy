import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Settings2, Upload } from "lucide-react";
import { usePermissions, useCurrentUser } from "@/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/configuracao")({
  component: ConfiguracaoPage,
});

type Endereco = {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
};

type FormState = {
  nome_municipio: string;
  uf: string;
  codigo_ibge: string;
  cnpj_prefeitura: string;
  razao_social: string;
  site_oficial: string;
  telefone: string;
  email_institucional: string;
  gestor_nome: string;
  gestor_cpf: string;
  vice_gestor_nome: string;
  vice_gestor_cpf: string;
  secretario_saude_nome: string;
  secretario_saude_cpf: string;
  brasao_url: string;
  logotipo_url: string;
  endereco: Endereco;
  dias_aviso_prazo_fechamento: string;
  limite_he_50: string;
  limite_he_100: string;
  limite_plantoes: string;
  mensagem_topo: string;
  permitir_envio_fora_prazo: boolean;
};

const EMPTY: FormState = {
  nome_municipio: "Oriximiná",
  uf: "PA",
  codigo_ibge: "",
  cnpj_prefeitura: "",
  razao_social: "",
  site_oficial: "",
  telefone: "",
  email_institucional: "",
  gestor_nome: "",
  gestor_cpf: "",
  vice_gestor_nome: "",
  vice_gestor_cpf: "",
  secretario_saude_nome: "",
  secretario_saude_cpf: "",
  brasao_url: "",
  logotipo_url: "",
  endereco: {},
  dias_aviso_prazo_fechamento: "5",
  limite_he_50: "",
  limite_he_100: "",
  limite_plantoes: "",
  mensagem_topo: "",
  permitir_envio_fora_prazo: false,
};

function ConfiguracaoPage() {
  const qc = useQueryClient();
  const { has, isLoading: permLoading } = usePermissions();
  const { data: userCtx } = useCurrentUser();
  const canManage = !!userCtx?.is_master || has("configuracao.editar");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [uploadingBrasao, setUploadingBrasao] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["municipio-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipio_config")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!config) return;
    const end = (config.endereco ?? {}) as Endereco;
    const params = (config.parametros ?? {}) as Record<string, unknown>;
    const asStr = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));
    setForm({
      nome_municipio: config.nome_municipio ?? "Oriximiná",
      uf: config.uf ?? "PA",
      codigo_ibge: config.codigo_ibge ?? "",
      cnpj_prefeitura: config.cnpj_prefeitura ?? "",
      razao_social: config.razao_social ?? "",
      site_oficial: config.site_oficial ?? "",
      telefone: config.telefone ?? "",
      email_institucional: config.email_institucional ?? "",
      gestor_nome: config.gestor_nome ?? "",
      gestor_cpf: config.gestor_cpf ?? "",
      vice_gestor_nome: config.vice_gestor_nome ?? "",
      vice_gestor_cpf: config.vice_gestor_cpf ?? "",
      secretario_saude_nome: config.secretario_saude_nome ?? "",
      secretario_saude_cpf: config.secretario_saude_cpf ?? "",
      brasao_url: config.brasao_url ?? "",
      logotipo_url: config.logotipo_url ?? "",
      endereco: end ?? {},
      dias_aviso_prazo_fechamento: asStr(params.dias_aviso_prazo_fechamento) || "5",
      limite_he_50: asStr(params.limite_he_50),
      limite_he_100: asStr(params.limite_he_100),
      limite_plantoes: asStr(params.limite_plantoes),
      mensagem_topo: typeof params.mensagem_topo === "string" ? params.mensagem_topo : "",
      permitir_envio_fora_prazo: params.permitir_envio_fora_prazo === true,
    });
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome_municipio.trim()) throw new Error("Nome do município é obrigatório");
      const payload = {
        nome_municipio: form.nome_municipio.trim(),
        uf: (form.uf.trim().toUpperCase() || "PA"),
        codigo_ibge: form.codigo_ibge.trim() || null,
        cnpj_prefeitura: form.cnpj_prefeitura.trim() || null,
        razao_social: form.razao_social.trim() || null,
        site_oficial: form.site_oficial.trim() || null,
        telefone: form.telefone.trim() || null,
        email_institucional: form.email_institucional.trim() || null,
        gestor_nome: form.gestor_nome.trim() || null,
        gestor_cpf: form.gestor_cpf.trim() || null,
        vice_gestor_nome: form.vice_gestor_nome.trim() || null,
        vice_gestor_cpf: form.vice_gestor_cpf.trim() || null,
        secretario_saude_nome: form.secretario_saude_nome.trim() || null,
        secretario_saude_cpf: form.secretario_saude_cpf.trim() || null,
        brasao_url: form.brasao_url || null,
        logotipo_url: form.logotipo_url || null,
        endereco: form.endereco as unknown as never,
        parametros: {
          ...(((config?.parametros ?? {}) as Record<string, unknown>) || {}),
          dias_aviso_prazo_fechamento: Number(form.dias_aviso_prazo_fechamento) || 5,
          limite_he_50: form.limite_he_50 === "" ? null : Number(form.limite_he_50),
          limite_he_100: form.limite_he_100 === "" ? null : Number(form.limite_he_100),
          limite_plantoes: form.limite_plantoes === "" ? null : Number(form.limite_plantoes),
          mensagem_topo: form.mensagem_topo.trim() || null,
          permitir_envio_fora_prazo: form.permitir_envio_fora_prazo,
        } as unknown as never,
      };
      if (config?.id) {
        const { error } = await supabase
          .from("municipio_config")
          .update(payload)
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("municipio_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Configuração salva com sucesso");
      qc.invalidateQueries({ queryKey: ["municipio-config"] });
      qc.invalidateQueries({ queryKey: ["municipio-parametros"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setEnd = (k: keyof Endereco, v: string) =>
    setForm((f) => ({ ...f, endereco: { ...f.endereco, [k]: v } }));

  async function uploadImage(
    file: File,
    kind: "brasao" | "logotipo",
    setLoading: (b: boolean) => void,
  ) {
    try {
      setLoading(true);
      const ext = file.name.split(".").pop() ?? "png";
      const path = `municipio/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("assinaturas")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = await supabase.storage
        .from("assinaturas")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const url = data?.signedUrl ?? path;
      setForm((f) => ({ ...f, [kind === "brasao" ? "brasao_url" : "logotipo_url"]: url }));
      toast.success(`${kind === "brasao" ? "Brasão" : "Logotipo"} carregado`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (permLoading || isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você não possui permissão para gerenciar a configuração municipal.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Configuração Municipal</h1>
          <p className="text-sm text-muted-foreground">
            Dados institucionais do município e da gestão de saúde.
          </p>
        </div>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Município
        </h2>
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-3">
            <Label>Nome do município *</Label>
            <Input
              value={form.nome_municipio}
              onChange={(e) => setForm({ ...form, nome_municipio: e.target.value })}
            />
          </div>
          <div>
            <Label>UF</Label>
            <Input
              maxLength={2}
              value={form.uf}
              onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Código IBGE</Label>
            <Input
              value={form.codigo_ibge}
              onChange={(e) => setForm({ ...form, codigo_ibge: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label>Razão social</Label>
            <Input
              value={form.razao_social}
              onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
              placeholder="Prefeitura Municipal de ..."
            />
          </div>
          <div className="md:col-span-3">
            <Label>CNPJ da prefeitura</Label>
            <Input
              value={form.cnpj_prefeitura}
              onChange={(e) => setForm({ ...form, cnpj_prefeitura: e.target.value })}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="md:col-span-3">
            <Label>Site oficial</Label>
            <Input
              value={form.site_oficial}
              onChange={(e) => setForm({ ...form, site_oficial: e.target.value })}
              placeholder="https://"
            />
          </div>
          <div className="md:col-span-3">
            <Label>E-mail institucional</Label>
            <Input
              type="email"
              value={form.email_institucional}
              onChange={(e) => setForm({ ...form, email_institucional: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label>Telefone</Label>
            <Input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Endereço
        </h2>
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-4">
            <Label>Logradouro</Label>
            <Input value={form.endereco.logradouro ?? ""} onChange={(e) => setEnd("logradouro", e.target.value)} />
          </div>
          <div>
            <Label>Número</Label>
            <Input value={form.endereco.numero ?? ""} onChange={(e) => setEnd("numero", e.target.value)} />
          </div>
          <div>
            <Label>CEP</Label>
            <Input value={form.endereco.cep ?? ""} onChange={(e) => setEnd("cep", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Complemento</Label>
            <Input value={form.endereco.complemento ?? ""} onChange={(e) => setEnd("complemento", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Bairro</Label>
            <Input value={form.endereco.bairro ?? ""} onChange={(e) => setEnd("bairro", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label>Cidade</Label>
            <Input value={form.endereco.cidade ?? ""} onChange={(e) => setEnd("cidade", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Gestão
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>Prefeito(a)</Label>
            <Input value={form.gestor_nome} onChange={(e) => setForm({ ...form, gestor_nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF do Prefeito(a)</Label>
            <Input value={form.gestor_cpf} onChange={(e) => setForm({ ...form, gestor_cpf: e.target.value })} />
          </div>
          <div>
            <Label>Vice-Prefeito(a)</Label>
            <Input value={form.vice_gestor_nome} onChange={(e) => setForm({ ...form, vice_gestor_nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF do Vice-Prefeito(a)</Label>
            <Input value={form.vice_gestor_cpf} onChange={(e) => setForm({ ...form, vice_gestor_cpf: e.target.value })} />
          </div>
          <div>
            <Label>Secretário(a) Municipal de Saúde</Label>
            <Input value={form.secretario_saude_nome} onChange={(e) => setForm({ ...form, secretario_saude_nome: e.target.value })} />
          </div>
          <div>
            <Label>CPF do Secretário(a) de Saúde</Label>
            <Input value={form.secretario_saude_cpf} onChange={(e) => setForm({ ...form, secretario_saude_cpf: e.target.value })} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Parâmetros de Fechamento e Alçada
        </h2>
        <p className="text-xs text-muted-foreground">
          Aviso de prazo no painel do diretor e limites de aprovação por valor (linhas que
          excederem exigem aprovação por usuário Master).
        </p>
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Label>Dias de aviso p/ fechamento</Label>
            <Input
              type="number" min={0} step={1}
              value={form.dias_aviso_prazo_fechamento}
              onChange={(e) => setForm({ ...form, dias_aviso_prazo_fechamento: e.target.value })}
            />
          </div>
          <div>
            <Label>Limite HE 50%</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.limite_he_50}
              placeholder="ilimitado"
              onChange={(e) => setForm({ ...form, limite_he_50: e.target.value })}
            />
          </div>
          <div>
            <Label>Limite HE 100%</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.limite_he_100}
              placeholder="ilimitado"
              onChange={(e) => setForm({ ...form, limite_he_100: e.target.value })}
            />
          </div>
          <div>
            <Label>Limite Plantões</Label>
            <Input
              type="number" min={0} step="0.01"
              value={form.limite_plantoes}
              placeholder="ilimitado"
              onChange={(e) => setForm({ ...form, limite_plantoes: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Avisos e regras de envio
        </h2>
        <div className="grid gap-4">
          <div>
            <Label>Mensagem de aviso no topo do sistema</Label>
            <Textarea
              rows={2}
              placeholder="Ex: Prazo de envio de frequências termina em 25/07. Após esta data, verifique com a SMS."
              value={form.mensagem_topo}
              onChange={(e) => setForm({ ...form, mensagem_topo: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Deixe em branco para não exibir aviso.</p>
          </div>
          <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={form.permitir_envio_fora_prazo}
              onChange={(e) => setForm({ ...form, permitir_envio_fora_prazo: e.target.checked })}
            />
            <div>
              <div className="text-sm font-medium">Permitir envio de frequência fora do prazo</div>
              <div className="text-xs text-muted-foreground">
                Se desligado, o botão "Enviar para análise" fica bloqueado após o prazo da competência.
                Se ligado, o envio é aceito e registrado em auditoria como "fora do prazo".
              </div>
            </div>
          </label>
        </div>
      </section>

      {userCtx?.is_master && (
        <section className="space-y-3 rounded-lg border bg-card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Cadastros institucionais (Master)
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <a
              href="/tipos-unidade"
              className="flex items-center justify-between rounded-md border p-4 hover:bg-accent transition"
            >
              <div>
                <div className="text-sm font-medium">Tipos de Unidade</div>
                <div className="text-xs text-muted-foreground">Gerenciar UBS, Hospital, CAPS, etc.</div>
              </div>
              <span className="text-sm text-primary">Abrir →</span>
            </a>
            <a
              href="/feriados"
              className="flex items-center justify-between rounded-md border p-4 hover:bg-accent transition"
            >
              <div>
                <div className="text-sm font-medium">Calendário de Feriados</div>
                <div className="text-xs text-muted-foreground">Feriados municipais, estaduais e nacionais.</div>
              </div>
              <span className="text-sm text-primary">Abrir →</span>
            </a>
          </div>
        </section>
      )}


      <section className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Identidade Visual
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Brasão do município</Label>
            <div className="flex items-center gap-3">
              {form.brasao_url ? (
                <img src={form.brasao_url} alt="Brasão" className="h-16 w-16 rounded border object-contain bg-muted/30" />
              ) : (
                <div className="h-16 w-16 rounded border bg-muted/30" />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploadingBrasao ? "Enviando..." : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f, "brasao", setUploadingBrasao);
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Logotipo da SMS</Label>
            <div className="flex items-center gap-3">
              {form.logotipo_url ? (
                <img src={form.logotipo_url} alt="Logotipo" className="h-16 w-16 rounded border object-contain bg-muted/30" />
              ) : (
                <div className="h-16 w-16 rounded border bg-muted/30" />
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" />
                {uploadingLogo ? "Enviando..." : "Enviar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadImage(f, "logotipo", setUploadingLogo);
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar configuração"}
        </Button>
      </div>
    </div>
  );
}
