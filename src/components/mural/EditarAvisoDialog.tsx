import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { editarAviso } from "@/lib/mural-avisos.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AsyncRichTextEditor } from "./editor/AsyncRichTextEditor";
import { Loader2 } from "lucide-react";

const schema = z.object({
  titulo: z.string().min(3, "Título deve ter no mínimo 3 caracteres"),
  subtitulo: z.string(),
  mensagem: z.string().min(5, "Mensagem deve ter no mínimo 5 caracteres"),
  tipo: z.enum(["informativo", "urgente", "manutencao"]),
  prioridade: z.enum(["baixa", "normal", "alta", "critica"]),
  data_fim: z.string(),
  fixado: z.boolean(),
  ativo: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

function toDateInput(value?: string | null) {
  if (!value) return "";
  return String(value).split("T")[0];
}

interface EditarAvisoDialogProps {
  aviso: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarAvisoDialog({ aviso, open, onOpenChange }: EditarAvisoDialogProps) {
  const queryClient = useQueryClient();
  const updateAviso = useServerFn(editarAviso);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      titulo: "",
      subtitulo: "",
      mensagem: "",
      tipo: "informativo",
      prioridade: "normal",
      data_fim: "",
      fixado: false,
      ativo: true,
    },
  });

  useEffect(() => {
    if (open && aviso) {
      form.reset({
        titulo: aviso.titulo ?? "",
        subtitulo: aviso.subtitulo ?? "",
        mensagem: aviso.mensagem ?? "",
        tipo: (aviso.tipo ?? "informativo") as FormValues["tipo"],
        prioridade: (aviso.prioridade ?? "normal") as FormValues["prioridade"],
        data_fim: toDateInput(aviso.data_fim),
        fixado: !!aviso.fixado,
        ativo: aviso.ativo !== false,
      });
    }
  }, [open, aviso, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateAviso({
        data: {
          id: aviso.id,
          titulo: values.titulo,
          subtitulo: values.subtitulo || null,
          mensagem: values.mensagem,
          tipo: values.tipo,
          prioridade: values.prioridade,
          data_fim: values.data_fim || null,
          fixado: values.fixado,
          ativo: values.ativo,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mural-avisos"] });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-popup"] });
      queryClient.invalidateQueries({ queryKey: ["mural-avisos-arquivados"] });
      toast.success("Aviso atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (err: any) =>
      toast.error(`Erro ao atualizar aviso: ${err?.message || "falha desconhecida"}`),
  });

  if (!aviso) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Aviso</DialogTitle>
          <DialogDescription>
            Atualize as informações do comunicado. As alterações são aplicadas imediatamente.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
                  <FormControl>
                    <Input placeholder="Título do aviso" {...field} />
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
                  <FormLabel>Subtítulo / Resumo</FormLabel>
                  <FormControl>
                    <Input placeholder="Opcional" {...field} />
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
                  <FormLabel>Mensagem</FormLabel>
                  <FormControl>
                    <AsyncRichTextEditor
                      content={field.value}
                      onChange={field.onChange}
                      dialogOpen={open}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="tipo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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

              <FormField
                control={form.control}
                name="data_fim"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Válido até</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription className="text-[11px]">Opcional</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="fixado"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Fixado</FormLabel>
                      <FormDescription className="text-[11px]">
                        Mantém o aviso no topo do mural
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ativo"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Aviso ativo</FormLabel>
                      <FormDescription className="text-[11px]">
                        Desative para arquivar o comunicado
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
