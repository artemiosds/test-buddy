import { useState, useEffect } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { criarSistema, editarSistema } from "@/lib/sistemas-externos-admin.functions";
import { gerarParDeChaves } from "@/lib/sso-keys";
import { toast } from "sonner";

const formSchema = z.object({
  nome: z.string().min(3, { message: "Nome deve ter pelo menos 3 caracteres" }),
  descricao: z.string(),
  url_base: z.string().url({ message: "URL Base inválida" }),
  icone: z.string(),
  cor: z.string(),
  ordem: z.number(),
  tipo_autenticacao: z.string(),
  endpoint_sso: z.string(),
  endpoint_logout: z.string(),
  endpoint_refresh: z.string(),
  audience: z.string(),
  issuer: z.string(),
  expiracao: z.number(),
  clock_skew: z.number(),
  nonce: z.string(),
  jti_enabled: z.boolean(),
  ativo: z.boolean(),
  public_key: z.string(),
  private_key: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface SistemaExternoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sistema?: any;
}

export function SistemaExternoDialog({ open, onOpenChange, sistema }: SistemaExternoDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!sistema;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "",
      url_base: "",
      icone: "Globe",
      cor: "#3b82f6",
      ordem: 0,
      tipo_autenticacao: "JWT SSO",
      endpoint_sso: "",
      endpoint_logout: "",
      endpoint_refresh: "",
      audience: "",
      issuer: "https://gestao-saude-sms-oriximina.vercel.app",
      expiracao: 300,
      clock_skew: 60,
      nonce: "",
      jti_enabled: true,
      ativo: true,
      public_key: "",
      private_key: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (sistema) {
        const isPlantao = sistema.nome?.toLowerCase().includes("plantão inteligente");
        form.reset({
          nome: sistema.nome || "",
          descricao: sistema.descricao || (isPlantao ? "Gestão de Plantões, Escalas e Escopos Médicos" : ""),
          url_base: sistema.url_base || (isPlantao ? "https://plantao-inteligente.vercel.app" : ""),
          icone: sistema.icone || (isPlantao ? "CalendarClock" : "Globe"),
          cor: sistema.cor || (isPlantao ? "#0F766E" : "#3b82f6"),
          ordem: Number(sistema.ordem) || (isPlantao ? 1 : 0),
          tipo_autenticacao: sistema.tipo_autenticacao || "JWT SSO",
          endpoint_sso: sistema.endpoint_sso || (isPlantao ? "https://plantao-inteligente.vercel.app/auth/sso" : ""),
          endpoint_logout: sistema.endpoint_logout || "",
          endpoint_refresh: sistema.endpoint_refresh || "",
          audience: sistema.audience || (isPlantao ? "plantao-inteligente" : ""),
          issuer: sistema.issuer || "https://gestao-saude-sms-oriximina.vercel.app",
          expiracao: Number(sistema.expiracao) || 300,
          clock_skew: Number(sistema.clock_skew) || 60,
          nonce: sistema.nonce || "",
          jti_enabled: sistema.jti_enabled ?? true,
          ativo: sistema.ativo ?? true,
          public_key: sistema.public_key || "",
          private_key: sistema.private_key || "",
        });
      } else {
        form.reset({
          nome: "",
          descricao: "",
          url_base: "",
          icone: "Globe",
          cor: "#3b82f6",
          ordem: 0,
          tipo_autenticacao: "JWT SSO",
          endpoint_sso: "",
          endpoint_logout: "",
          endpoint_refresh: "",
          audience: "",
          issuer: "https://gestao-saude-sms-oriximina.vercel.app",
          expiracao: 300,
          clock_skew: 60,
          nonce: "",
          jti_enabled: true,
          ativo: true,
          public_key: "",
          private_key: "",
        });
      }
    }
  }, [open, sistema, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEditing) {
        return editarSistema({ data: { id: sistema.id, updates: values as any } });
      } else {
        return criarSistema({ data: values as any });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sistemas-externos"] });
      toast.success(isEditing ? "Sistema atualizado!" : "Sistema criado!");
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast.error("Erro ao salvar: " + error.message);
    },
  });

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    mutation.mutate(values);
  };

  const handleGenerateKeys = async () => {
    const toastId = toast.loading("Gerando novo par de chaves RSA...");
    try {
      const chaves = await gerarParDeChaves();
      form.setValue("public_key", chaves.publicKeyPem);
      form.setValue("private_key", chaves.privateKeyPem);
      toast.success("Chaves geradas!", { id: toastId });
    } catch (error: any) {
      toast.error("Erro: " + error.message, { id: toastId });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Sistema" : "Novo Sistema Externo"}</DialogTitle>
          <DialogDescription>
            Configure as credenciais e endpoints para integração via SSO.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="geral" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="geral">Geral</TabsTrigger>
                <TabsTrigger value="sso">Segurança/SSO</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: e-SUS" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="url_base"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL Base</FormLabel>
                        <FormControl>
                          <Input placeholder="https://..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Para que serve este sistema?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="icone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ícone</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Globe">Global</SelectItem>
                            <SelectItem value="LayoutGrid">Dashboard</SelectItem>
                            <SelectItem value="CalendarClock">Plantão</SelectItem>
                            <SelectItem value="Shield">Segurança</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cor</FormLabel>
                        <FormControl>
                          <Input type="color" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ordem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ordem</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="ativo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Sistema Ativo</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="sso" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="issuer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issuer (iss)</FormLabel>
                        <FormControl>
                          <Input placeholder="Identificador único" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="audience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Audience (aud)</FormLabel>
                        <FormControl>
                          <Input placeholder="URL ou ID do destino" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="endpoint_sso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Endpoint SSO</FormLabel>
                        <FormControl>
                          <Input placeholder="/auth/sso" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiracao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiração (s)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <FormLabel>Chaves RSA (Auditoria SSO)</FormLabel>
                    <Button type="button" variant="outline" size="sm" onClick={handleGenerateKeys} className="w-full">
                      Gerar Novo Par de Chaves
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name="public_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Chave Pública (PEM)</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="font-mono text-[10px]" rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="private_key"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Chave Privada (Secret)</FormLabel>
                        <FormControl>
                          <Textarea {...field} className="font-mono text-[10px]" rows={4} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
