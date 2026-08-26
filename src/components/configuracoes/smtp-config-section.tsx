import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Save, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  obterConfiguracaoSMTP,
  salvarConfiguracaoSMTP,
  testarConexaoSMTP,
} from "@/lib/configuracoes-smtp.functions";

type FormSmtp = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  smtp_secure: boolean;
  smtp_ativo: boolean;
};

const VAZIO: FormSmtp = {
  smtp_host: "",
  smtp_port: 587,
  smtp_user: "",
  smtp_password: "",
  smtp_from_email: "",
  smtp_from_name: "HSM Gestão — SMS Oriximiná",
  smtp_secure: false,
  smtp_ativo: true,
};

export function SmtpConfigSection() {
  const qc = useQueryClient();
  const obterFn = useServerFn(obterConfiguracaoSMTP);
  const salvarFn = useServerFn(salvarConfiguracaoSMTP);
  const testarFn = useServerFn(testarConexaoSMTP);

  const [form, setForm] = useState<FormSmtp>(VAZIO);
  const [inicializado, setInicializado] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["smtp-config"],
    queryFn: () => obterFn(),
  });

  useEffect(() => {
    if (!data || inicializado) return;

    const fromEmail = data.smtp_from_email?.trim() || data.smtp_user?.trim() || "";
    const fromName = data.smtp_from_name?.trim() || VAZIO.smtp_from_name;
    const secure = !!data.smtp_secure;

    setForm({
      smtp_host: data.smtp_host?.trim() || "",
      smtp_port: data.smtp_port ?? (secure ? 465 : 587),
      smtp_user: data.smtp_user?.trim() || "",
      smtp_password: data.smtp_password ?? "",
      smtp_from_email: fromEmail,
      smtp_from_name: fromName,
      smtp_secure: secure,
      smtp_ativo: data.smtp_ativo !== false,
    });
    setInicializado(true);
  }, [data, inicializado]);


  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: form }),
    onSuccess: () => {
      toast.success("Configuração de e-mail salva com sucesso");
      qc.invalidateQueries({ queryKey: ["smtp-config"] });
    },
    onError: (e: Error) => toast.error("Falha ao salvar", { description: e.message }),
  });

  const testar = useMutation({
    mutationFn: () => testarFn({ data: form }),
    onSuccess: (r) => {
      if (r.sucesso) toast.success(r.mensagem);
      else toast.error("Falha na conexão SMTP", { description: `${r.erro}${r.codigo ? ` (${r.codigo})` : ""}` });
    },
    onError: (e: Error) => toast.error("Falha ao testar conexão", { description: e.message }),
  });

  const setProtocolo = (v: string) => {
    const ssl = v === "ssl";
    setForm((f) => ({ ...f, smtp_secure: ssl, smtp_port: ssl ? 465 : 587 }));
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Mail className="h-4 w-4" />
            Servidor de E-mail (SMTP)
          </h2>
          <p className="text-xs text-muted-foreground">
            Credenciais usadas para notificações de competências, avisos do mural e alertas do sistema.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="smtp_ativo" className="text-xs">
            Serviço ativo
          </Label>
          <Switch
            id="smtp_ativo"
            checked={form.smtp_ativo}
            onCheckedChange={(v) => setForm((f) => ({ ...f, smtp_ativo: v }))}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando configuração...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Servidor SMTP</Label>
              <Input
                value={form.smtp_host}
                placeholder="smtp.gmail.com"
                onChange={(e) => setForm({ ...form, smtp_host: e.target.value })}
              />
            </div>
            <div>
              <Label>Porta</Label>
              <Input
                type="number"
                value={form.smtp_port}
                onChange={(e) => setForm({ ...form, smtp_port: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Protocolo de segurança</Label>
              <Select value={form.smtp_secure ? "ssl" : "starttls"} onValueChange={setProtocolo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starttls">STARTTLS (porta 587)</SelectItem>
                  <SelectItem value="ssl">SSL (porta 465)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Usuário de autenticação</Label>
              <Input
                value={form.smtp_user}
                placeholder="notificacoes@oriximina.pa.gov.br"
                onChange={(e) => setForm({ ...form, smtp_user: e.target.value })}
              />
            </div>
            <div className="md:col-span-3">
              <Label>Senha / Senha de aplicativo</Label>
              <div className="flex gap-2">
                <Input
                  type={mostrarSenha ? "text" : "password"}
                  value={form.smtp_password}
                  placeholder="Deixe em branco para manter a senha atual"
                  onChange={(e) => setForm({ ...form, smtp_password: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Deixe em branco para manter a senha atual.
              </p>
            </div>
            <div className="md:col-span-2">
              <Label>E-mail do remetente</Label>
              <Input
                value={form.smtp_from_email}
                placeholder="naoresponda@oriximina.pa.gov.br"
                onChange={(e) => setForm({ ...form, smtp_from_email: e.target.value })}
              />
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input
                value={form.smtp_from_name}
                onChange={(e) => setForm({ ...form, smtp_from_name: e.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {data?.existe
                ? `Última alteração: ${data.updated_at ? new Date(data.updated_at).toLocaleString("pt-BR") : "—"}`
                : "Ainda não salvo no banco — valores sugeridos a partir das variáveis de ambiente."}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => testar.mutate()}
                disabled={!inicializado || testar.isPending || !form.smtp_host.trim() || !form.smtp_user.trim()}
              >
                <SendHorizonal className="mr-2 h-4 w-4" />
                {testar.isPending ? "Testando..." : "Testar conexão / enviar e-mail teste"}
              </Button>
              <Button
                type="button"
                onClick={() => salvar.mutate()}
                disabled={!inicializado || salvar.isPending || !form.smtp_host.trim() || !form.smtp_user.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                {salvar.isPending ? "Salvando..." : "Salvar alterações"}
              </Button>

            </div>
          </div>
        </>
      )}
    </section>
  );
}
