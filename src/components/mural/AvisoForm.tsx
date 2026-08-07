import { useState, useRef, useMemo } from "react";
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
import { AsyncRichTextEditor } from "./editor/AsyncRichTextEditor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  File as FileIcon, 
  Trash2, 
  Eye, 
  Download, 
  Paperclip, 
  Users, 
  Clock, 
  Bell, 
  Pin,
  Save,
  Send,
  X
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

const anexoSchema = z.object({
  nome: z.string(),
  path: z.string(),
  mime: z.string(),
  size: z.number(),
  bucket: z.string(),
});

const formSchema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  subtitulo: z.string().default(""),
  mensagem: z.string().min(5, "Mensagem deve ter no mínimo 5 caracteres"),
  tipo: z.enum(['informativo', 'urgente', 'manutencao']),
  prioridade: z.enum(['baixa', 'normal', 'alta', 'critica']),
  fixado: z.boolean(),
  confirmacao_obrigatoria: z.boolean(),
  destinatarios_tipo: z.enum(['todos', 'perfis', 'unidades']),
  destinatarios_valores: z.array(z.string()),
  data_inicio: z.string(),
  data_fim: z.string().nullable(),
  hora_inicio: z.string(),
  hora_fim: z.string().nullable(),
  notificar_email: z.boolean(),
  notificar_whatsapp: z.boolean(),
  ativa_modo_manutencao: z.boolean(),
  previsao_termino: z.string().nullable(),
  anexos: z.array(anexoSchema),
  status: z.enum(['rascunho', 'publicado']),
  mostrar_dashboard: z.boolean(),
  mostrar_login: z.boolean(),
  destacar_vermelho: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface AvisoFormProps {
  onSuccess?: () => void;
  initialData?: any;
  dialogOpen?: boolean;
}

export function AvisoForm({ onSuccess, initialData, dialogOpen = true }: AvisoFormProps) {
  const queryClient = useQueryClient();
  const createAvisoFn = useServerFn(criarAviso);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: unidades } = useQuery({
    queryKey: ["unidades-simples"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("id, nome").order("nome");
      if (error) throw error;
      return data;
    }
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: initialData || {
      titulo: "",
      subtitulo: "",
      mensagem: "",
      tipo: "informativo",
      prioridade: "normal",
      fixado: false,
      confirmacao_obrigatoria: false,
      destinatarios_tipo: "todos",
      destinatarios_valores: [],
      data_inicio: new Date().toISOString().split('T')[0],
      hora_inicio: "08:00",
      data_fim: null,
      hora_fim: null,
      notificar_email: false,
      notificar_whatsapp: false,
      ativa_modo_manutencao: true,
      previsao_termino: null,
      anexos: [],
      status: "publicado",
      mostrar_dashboard: true,
      mostrar_login: true,
      destacar_vermelho: false,
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
      return createAvisoFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(form.getValues("status") === 'publicado' ? "Aviso publicado!" : "Rascunho salvo!");
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error(`Erro: ${err.message}`);
    }
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    const newAnexos = [...form.getValues("anexos")];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `mural/${fileName}`;

      const { data, error } = await supabase.storage
        .from('mural_anexos')
        .upload(filePath, file);

      if (error) {
        toast.error(`Erro ao subir ${file.name}`);
        continue;
      }

      newAnexos.push({
        nome: file.name,
        path: filePath,
        mime: file.type,
        size: file.size,
        bucket: 'mural_anexos'
      });
      
      setUploadProgress(((i + 1) / files.length) * 100);
    }

    form.setValue("anexos", newAnexos);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAnexo = (index: number) => {
    const current = form.getValues("anexos");
    form.setValue("anexos", current.filter((_, i) => i !== index));
  };

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  const destTipo = form.watch("destinatarios_tipo");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ScrollArea className="h-[70vh] px-1">
          <div className="space-y-6 pb-6">
            {/* Card 1: Informações Gerais */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> 1. Informações Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input placeholder="Título do comunicado" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subtitulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subtítulo (Opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Breve descrição" {...field} value={field.value || ""} />
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
                        <FormLabel>Categoria</FormLabel>
                        <Select 
                          onValueChange={(val) => {
                            field.onChange(val);
                            if (val === 'manutencao') {
                              form.setValue('ativa_modo_manutencao', true);
                              form.setValue('prioridade', 'critica');
                              form.setValue('fixado', true);
                              form.setValue('destacar_vermelho', true);
                            }
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="informativo">Informativo</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                            <SelectItem value="manutencao">Manutenção</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  {form.watch("tipo") === "manutencao" && (
                    <div className="col-span-2 p-3 border border-destructive/20 bg-destructive/5 rounded-lg space-y-3">
                      <FormField
                        control={form.control}
                        name="ativa_modo_manutencao"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox 
                                id="force-manutencao" 
                                checked={field.value} 
                                onCheckedChange={field.onChange} 
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel htmlFor="force-manutencao" className="text-xs font-bold text-destructive">
                                Ativar Bloqueio Total do Sistema
                              </FormLabel>
                              <p className="text-[10px] text-muted-foreground">
                                Impede o acesso de todos os usuários (exceto Master)
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="previsao_termino"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Previsão de Término</FormLabel>
                            <FormControl>
                              <Input 
                                type="datetime-local" 
                                {...field} 
                                value={field.value || ""} 
                                className="h-8 text-xs" 
                                placeholder="Data e hora prevista"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="prioridade"
                    render={({ field }) => (
                      <FormItem className={form.watch("tipo") === "manutencao" ? "col-span-2" : ""}>
                        <FormLabel>Prioridade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="critica">Crítica</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Editor Rico */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> 2. Conteúdo da Mensagem
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <FormField
                  control={form.control}
                  name="mensagem"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Mensagem</FormLabel>
                      <FormControl>
                        <AsyncRichTextEditor 
                          content={field.value} 
                          onChange={field.onChange} 
                          dialogOpen={dialogOpen}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 3: Anexos */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" /> 3. Anexos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="anexos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Anexos</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <div 
                            className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input 
                              type="file" 
                              multiple 
                              className="hidden" 
                              ref={fileInputRef} 
                              onChange={handleFileUpload} 
                            />
                            <Paperclip className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm font-medium">Clique ou arraste arquivos aqui</p>
                            <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Imagens (Máx 10 arquivos)</p>
                          </div>

                          {uploading && (
                            <div className="space-y-2">
                              <Progress value={uploadProgress} className="h-2" />
                              <p className="text-[10px] text-center text-muted-foreground">Enviando arquivos...</p>
                            </div>
                          )}

                          <div className="grid grid-cols-1 gap-2">
                            {field.value.map((anexo: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <FileIcon className="h-4 w-4 shrink-0 text-primary" />
                                  <span className="text-xs truncate font-medium">{anexo.nome}</span>
                                  <span className="text-[10px] text-muted-foreground">({(anexo.size / 1024).toFixed(1)} KB)</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" type="button">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeAnexo(idx)} type="button">
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Card 4: Destinatários */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> 4. Público Alvo
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <FormField
                  control={form.control}
                  name="destinatarios_tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="sr-only">Tipo de Destinatário</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todos">Todos os Usuários</SelectItem>
                          <SelectItem value="perfis">Por Perfil</SelectItem>
                          <SelectItem value="unidades">Por Unidade</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                {destTipo === 'perfis' && (
                  <FormField
                    control={form.control}
                    name="destinatarios_valores"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">Perfis Destinatários</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-2">
                            {['MASTER', 'GESTOR', 'DIRETOR_UNIDADE', 'PROFISSIONAL'].map(perfil => (
                              <div key={perfil} className="flex items-center space-x-2">
                                <Checkbox 
                                  id={`perfil-${perfil}`}
                                  checked={field.value.includes(perfil)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, perfil]);
                                    } else {
                                      field.onChange(field.value.filter((p: string) => p !== perfil));
                                    }
                                  }}
                                />
                                <label htmlFor={`perfil-${perfil}`} className="text-xs font-medium leading-none cursor-pointer">
                                  {perfil.replace('_', ' ')}
                                </label>
                              </div>
                            ))}
                          </div>
                        </FormControl>
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
                      <FormLabel className="sr-only">Unidades Selecionadas</FormLabel>
                      <Select onValueChange={(val) => !field.value.includes(val) && field.onChange([...field.value, val])}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Adicionar unidades" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unidades?.map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {field.value.map(v => (
                            <Badge key={v} variant="secondary" className="text-[10px]">
                              {unidades?.find(u => u.id === v)?.nome || v}
                              <X className="h-2 w-2 ml-1 cursor-pointer" onClick={() => field.onChange(field.value.filter(x => x !== v))} />
                            </Badge>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Card 5: Publicação e Opções */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> 5. Publicação e Exibição
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_inicio"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs">Data de Início</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input type="date" {...field} className="h-8 text-xs" />
                            <Input type="time" {...form.register("hora_inicio")} className="h-8 text-xs" />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="data_fim"
                    render={({ field }) => (
                      <FormItem className="space-y-2">
                        <FormLabel className="text-xs">Expiração (Opcional)</FormLabel>
                        <FormControl>
                          <div className="flex gap-2">
                            <Input 
                              type="date" 
                              value={field.value || ""} 
                              onChange={field.onChange} 
                              className="h-8 text-xs" 
                            />
                            <Input 
                              type="time" 
                              {...form.register("hora_fim")}
                              className="h-8 text-xs" 
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <FormField
                    control={form.control}
                    name="fixado"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-bold">Fixar no topo</FormLabel>
                          <p className="text-[10px] text-muted-foreground">Mantém o aviso sempre visível primeiro</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="destacar_vermelho"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-bold">Destaque Vermelho</FormLabel>
                          <p className="text-[10px] text-muted-foreground">Exibe o aviso com borda e ícone em vermelho</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="confirmacao_obrigatoria"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel className="text-xs font-bold">Exigir Confirmação</FormLabel>
                          <p className="text-[10px] text-muted-foreground">O usuário deve clicar em "Ciente" para fechar</p>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3 pt-2 border-t">
                  <div className="flex flex-wrap gap-4">
                    <FormField
                      control={form.control}
                      name="mostrar_dashboard"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox id="opt-dash" checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <label htmlFor="opt-dash" className="text-[10px] font-medium leading-none cursor-pointer">Dashboard</label>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="mostrar_login"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox id="opt-login" checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <label htmlFor="opt-login" className="text-[10px] font-medium leading-none cursor-pointer">Login</label>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notificar_email"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox id="opt-email" checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <label htmlFor="opt-email" className="text-[10px] font-medium leading-none cursor-pointer">E-mail</label>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center pt-4 border-t gap-2">
          <Button variant="outline" size="sm" type="button" onClick={() => onSuccess?.()}>
            Cancelar
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              type="button" 
              className="gap-2"
              onClick={() => {
                form.setValue("status", "rascunho");
                form.handleSubmit(onSubmit)();
              }}
              disabled={mutation.isPending}
            >
              <Save className="h-4 w-4" /> Salvar Rascunho
            </Button>
            <Button 
              size="sm" 
              type="submit" 
              className="gap-2"
              onClick={() => form.setValue("status", "publicado")}
              disabled={mutation.isPending}
            >
              <Send className="h-4 w-4" /> Publicar Aviso
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
