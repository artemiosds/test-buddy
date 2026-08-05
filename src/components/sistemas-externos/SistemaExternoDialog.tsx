import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  FormDescription,
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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(),
  url_base: z.string().url("URL Base inválida"),
  icone: z.string(),
  cor: z.string(),
  ordem: z.coerce.number(),
  tipo_autenticacao: z.string(),
  endpoint_sso: z.string().optional(),
  endpoint_logout: z.string().optional(),
  endpoint_refresh: z.string().optional(),
  audience: z.string().optional(),
  issuer: z.string().optional(),
  token_exp_segundos: z.coerce.number(),
  clock_skew_segundos: z.coerce.number().optional(),
  nonce: z.string().optional(),
  jti_enabled: z.boolean().optional(),
  ativo: z.boolean(),
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
      issuer: "",
      token_exp_segundos: 60,
      clock_skew_segundos: 0,
      nonce: "",
      jti_enabled: true,
      ativo: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (sistema) {
        form.reset({
          nome: sistema.nome || "",
          descricao: sistema.descricao || "",
          url_base: sistema.url_base || "",
          icone: sistema.icone || "Globe",
          cor: sistema.cor || "#3b82f6",
          ordem: sistema.ordem || 0,
          tipo_autenticacao: sistema.tipo_autenticacao || "JWT SSO",
          endpoint_sso: sistema.endpoint_sso || "",
          endpoint_logout: sistema.endpoint_logout || "",
          endpoint_refresh: sistema.endpoint_refresh || "",
          audience: sistema.audience || "",
          issuer: sistema.issuer || "",
          token_exp_segundos: sistema.token_exp_segundos || 60,
          clock_skew_segundos: sistema.clock_skew_segundos || 0,
          nonce: sistema.nonce || "",
          jti_enabled: sistema.jti_enabled ?? true,
          ativo: sistema.ativo ?? true,
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
          issuer: "",
          token_exp_segundos: 60,
          clock_skew_segundos: 0,
          nonce: "",
          jti_enabled: true,
          ativo: true,
        });
      }
    }
  }, [open, sistema, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (isEditing) {
        return editarSistema({ data: { id: sistema.id, updates: values } });
      } else {
        return criarSistema({ data: values });
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

  function onSubmit(values: FormValues) {
    mutation.mutate(values);
  }


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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                        <FormDescription>
                          Habilita ou desabilita o acesso ao sistema.
                        </FormDescription>
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
                    name="token_exp_segundos"
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="clock_skew_segundos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Clock Skew (s)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormDescription>Tolerância de atraso de relógio.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nonce"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nonce (Opcional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Valor aleatório de segurança" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="jti_enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Habilitar JTI</FormLabel>
                        <FormDescription>
                          Gera um ID único para cada token (evita replay attacks).
                        </FormDescription>
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

                <FormField
                  control={form.control}
                  name="tipo_autenticacao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Autenticação</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o método" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="JWT SSO">JWT SSO (Padrão)</SelectItem>
                          <SelectItem value="OAuth2">OAuth2</SelectItem>
                          <SelectItem value="SAML">SAML</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Atualmente o sistema processa automaticamente tokens JWT.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? "Salvar Alterações" : "Criar Sistema"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
