import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { criarAviso } from "@/lib/mural-avisos.functions";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  mensagem: z.string().min(5, "Mensagem deve ter no mínimo 5 caracteres"),
  tipo: z.enum(['informativo', 'urgente', 'manutencao']),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'critica']),
  fixado: z.boolean(),
  confirmacao_obrigatoria: z.boolean(),
  destinatarios_tipo: z.enum(['todos', 'perfis', 'unidades']),
  destinatarios_valores: z.array(z.string()),
  data_inicio: z.string(),
  data_fim: z.string().nullable(),
  notificar_email: z.boolean(),
  ativa_modo_manutencao: z.boolean(),
  previsao_termino: z.string().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface AvisoFormProps {
  onSuccess?: () => void;
}

export function AvisoForm({ onSuccess }: AvisoFormProps) {
  const queryClient = useQueryClient();
  const createAviso = useServerFn(criarAviso);

  const { data: unidades } = useQuery({
    queryKey: ["unidades-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: "",
      mensagem: "",
      tipo: "informativo",
      prioridade: "normal",
      fixado: false,
      confirmacao_obrigatoria: false,
      destinatarios_tipo: "todos",
      destinatarios_valores: [],
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: null,
      notificar_email: false,
      ativa_modo_manutencao: false,
      previsao_termino: null,
    },
  });


  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        destinatarios: {
          tipo: values.destinatarios_tipo,
          valores: values.destinatarios_valores
        }
      };
      return createAviso({ data: payload });
    },
    onSuccess: () => {
      toast.success("Aviso criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(`Erro ao criar aviso: ${err.message}`);
    }
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const destTipo = form.watch("destinatarios_tipo");
  const tipoAviso = form.watch("tipo");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="titulo"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título *</FormLabel>
              <FormControl>
                <Input placeholder="Título do aviso" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="mensagem"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem *</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Escreva a mensagem do aviso..." 
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="informativo">Informativo</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                    <SelectItem value="manutencao">Manutenção</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="prioridade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prioridade</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a prioridade" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 py-2 border-y my-2">
          <FormField
            control={form.control}
            name="fixado"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer text-sm">Fixar no topo</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmacao_obrigatoria"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer text-sm">Confirmação obrigatória</FormLabel>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notificar_email"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-0">
                  <FormLabel className="cursor-pointer text-sm font-medium">Notificar por e-mail</FormLabel>
                  <p className="text-[0.65rem] text-muted-foreground leading-tight">
                    Envia e-mail imediatamente para os destinatários.
                  </p>
        </div>

        {tipoAviso === 'manutencao' && (
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 space-y-4 my-2">
            <h4 className="text-sm font-bold text-yellow-800 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-yellow-600 animate-pulse" />
              Opções de Manutenção
            </h4>
            
            <div className="flex flex-wrap items-center gap-6">
              <FormField
                control={form.control}
                name="ativa_modo_manutencao"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-0">
                      <FormLabel className="cursor-pointer text-sm font-bold text-yellow-900">Bloquear Acesso Geral</FormLabel>
                      <p className="text-[0.65rem] text-yellow-700 leading-tight">
                        Ativa a tela de manutenção para todos (exceto MASTER).
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="previsao_termino"
                render={({ field }) => (
                  <FormItem className="flex-1 min-w-[200px] space-y-1">
                    <FormLabel className="text-xs text-yellow-800">Previsão de Término</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        className="h-8 text-xs bg-white border-yellow-200"
                        value={field.value || ""} 
                        onChange={e => field.onChange(e.target.value || null)} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">

           <FormField
            control={form.control}
            name="destinatarios_tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Público Alvo</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Para quem?" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="perfis">Por Perfil</SelectItem>
                    <SelectItem value="unidades">Por Unidade</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {destTipo === 'perfis' && (
            <FormField
              control={form.control}
              name="destinatarios_valores"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selecionar Perfis</FormLabel>
                  <FormControl>
                    <Select 
                      onValueChange={(val) => field.onChange([...(field.value || []), val])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Adicionar perfil" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MASTER">MASTER</SelectItem>
                        <SelectItem value="GESTOR">GESTOR</SelectItem>
                        <SelectItem value="DIRETOR_UNIDADE">DIRETOR UNIDADE</SelectItem>
                        <SelectItem value="PROFISSIONAL">PROFISSIONAL</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {field.value?.map(v => (
                      <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => field.onChange(field.value?.filter(x => x !== v))}>
                        {v} ×
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {destTipo === 'unidades' && (
            <FormField
              control={form.control}
              name="destinatarios_valores"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selecionar Unidades</FormLabel>
                  <FormControl>
                    <Select 
                      onValueChange={(val) => field.onChange([...(field.value || []), val])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Adicionar unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        {unidades?.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {field.value?.map(v => {
                      const u = unidades?.find(x => x.id === v);
                      return (
                        <Badge key={v} variant="secondary" className="cursor-pointer" onClick={() => field.onChange(field.value?.filter(x => x !== v))}>
                          {u?.nome || v} ×
                        </Badge>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="data_inicio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Início da Exibição</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="data_fim"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fim da Exibição (Opcional)</FormLabel>
                <FormControl>
                  <Input 
                    type="date" 
                    value={field.value || ""} 
                    onChange={e => field.onChange(e.target.value || null)} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? "Criando..." : "Criar Aviso"}
        </Button>
      </form>
    </Form>
  );
}
