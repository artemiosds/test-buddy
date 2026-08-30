import { ErrorComponent } from "@/components/shared/ErrorComponent";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Plus, Pencil, PowerOff, Power, Briefcase, Trash2, ChevronRight, ChevronDown, Download, Search } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-permissions";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cargoFormSchema, funcaoFormSchema, AREAS_PROFISSIONAIS, type CargoFormData, type FuncaoFormData, type NivelCargo, type AreaProfissional } from "@/lib/cargos-funcoes.validation";
import { maskCBO, maskGratificacao, FormError } from "@/utils/cargos-funcoes.masks";
import { z } from "zod";
import { fallback } from "@/lib/search-validator";

const searchSchema = z.object({
  search: fallback(z.string(), "").default(""),
  cPage: fallback(z.number().int(), 1).default(1),
  fPage: fallback(z.number().int(), 1).default(1),
});

export const Route = createFileRoute("/_authenticated/cargos-funcoes")({
  validateSearch: searchSchema,
  errorComponent: ErrorComponent,
  component: CargosFuncoesPage,
});

type Cargo = {
  id: string;
  nome: string;
  codigo: string | null;
  cbo: string | null;
  nivel: NivelCargo | null;
  area_profissional: AreaProfissional | null;
  exige_conselho: boolean;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
  funcoes?: Funcao[];
};

type Funcao = {
  id: string;
  nome: string;
  codigo: string | null;
  gratificacao_percentual: number | null;
  cargo_id: string | null;
  status: "ativa" | "inativa" | "suspensa" | "arquivada";
};

const NIVEIS = [
  { v: "fundamental", l: "Fundamental" },
  { v: "medio", l: "Médio" },
  { v: "tecnico", l: "Técnico" },
  { v: "superior", l: "Superior" },
  { v: "pos_graduacao", l: "Pós-graduação" },
] as const;

function CargosFuncoesPage() {
  const { data: userCtx, isLoading: userLoading } = useCurrentUser();
  const isMaster = !!userCtx?.is_master;
  const qc = useQueryClient();
  const nav = useNavigate({ from: Route.fullPath });
  const { search: searchParam, cPage, fPage } = Route.useSearch();
  
  const [filtro, setFiltro] = useState<'todos' | 'cargos' | 'funcoes'>('todos');
  const itemsPerPage = 15;
  const [expandedCargos, setExpandedCargos] = useState<Set<string>>(new Set());
  const [cargoDialogOpen, setCargoDialogOpen] = useState(false);
  const [funcaoDialogOpen, setFuncaoDialogOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null);
  const [editingFuncao, setEditingFuncao] = useState<Funcao | null>(null);
  const [selectedCargoId, setSelectedCargoId] = useState<string | null>(null);

  const cargoForm = useForm<CargoFormData>({
    resolver: zodResolver(cargoFormSchema) as any,
    defaultValues: {
      nome: "",
      codigo: null,
      cbo: null,
      nivel: null,
      area_profissional: "Outros",
      exige_conselho: false,
    },
  });

  const funcaoForm = useForm<FuncaoFormData>({
    resolver: zodResolver(funcaoFormSchema) as any,
    defaultValues: {
      nome: "",
      codigo: null,
      gratificacao_percentual: 0,
      cargo_id: null,
    },
  });

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["cargos-funcoes-consolidado"],
    queryFn: async () => {
      const { data: cargos, error: cErr } = await supabase
        .from("cargos")
        .select(`
          *,
          funcoes (*)
        `)
        .is("deleted_at", null)
        .order("nome");
      
      if (cErr) throw cErr;
      
      return (cargos as any[]).map(c => ({
        ...c,
        funcoes: c.funcoes?.filter((f: any) => !f.deleted_at) || []
      })) as Cargo[];
    },
  });

  const { data: uso = { cargos: {}, funcoes: {} } } = useQuery({
    queryKey: ["cargos-funcoes-uso"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cargos_funcoes_uso");
      if (error) throw error;
      const result = data as any;
      return { 
        cargos: result?.cargos || {}, 
        funcoes: result?.funcoes || {} 
      } as { cargos: Record<string, number>, funcoes: Record<string, number> };
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    const term = searchParam.toLowerCase();

    if (filtro === 'cargos') {
      return rawData.filter(cargo => 
        cargo.nome.toLowerCase().includes(term) || (cargo.cbo?.toLowerCase().includes(term) ?? false)
      );
    }

    if (filtro === 'funcoes') {
      const allFuncoes: (Funcao & { cargo_nome: string, cargo_uso: number })[] = [];
      rawData.forEach(cargo => {
        const matchingFuncoes = (cargo.funcoes || []).filter(f => f.nome.toLowerCase().includes(term));
        matchingFuncoes.forEach(f => {
          allFuncoes.push({ ...f, cargo_nome: cargo.nome, cargo_uso: uso.cargos[cargo.id] || 0 });
        });
      });
      return allFuncoes;
    }

    // Default: todos
    if (!term) return rawData;
    
    return rawData.filter(cargo => {
      const cargoMatch = cargo.nome.toLowerCase().includes(term) || (cargo.cbo?.toLowerCase().includes(term) ?? false);
      const funcoesMatch = cargo.funcoes?.some(f => f.nome.toLowerCase().includes(term)) ?? false;
      
      if (funcoesMatch && !cargoMatch) {
        setExpandedCargos(prev => {
          if (prev.has(cargo.id)) return prev;
          const next = new Set(prev);
          next.add(cargo.id);
          return next;
        });
      }
      
      return cargoMatch || funcoesMatch;
    });
  }, [rawData, searchParam, filtro, uso]);

  const pagedData = useMemo(() => {
    const currentPage = filtro === 'funcoes' ? fPage : cPage;
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, cPage, fPage, filtro]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    nav({
      search: (prev: z.infer<typeof searchSchema>) => ({
        ...prev,
        [filtro === 'funcoes' ? 'fPage' : 'cPage']: newPage
      })
    });
  };

  const toggleCargo = (id: string) => {
    setExpandedCargos(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const saveCargoMut = useMutation({
    mutationFn: async (values: CargoFormData) => {
      if (editingCargo) {
        const { error } = await supabase.from("cargos").update(values as any).eq("id", editingCargo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cargos").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingCargo ? "Cargo atualizado" : "Cargo criado");
      setCargoDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["cargos-funcoes-consolidado"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveFuncaoMut = useMutation({
    mutationFn: async (values: FuncaoFormData) => {
      if (editingFuncao) {
        const { error } = await supabase.from("funcoes").update(values as any).eq("id", editingFuncao.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("funcoes").insert(values as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingFuncao ? "Função atualizada" : "Função criada");
      setFuncaoDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["cargos-funcoes-consolidado"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCargoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("cargos")
        .update({ deleted_at: new Date().toISOString(), status: "arquivada" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cargo excluído");
      qc.invalidateQueries({ queryKey: ["cargos-funcoes-consolidado"] });
    },
  });

  const deleteFuncaoMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("funcoes")
        .update({ deleted_at: new Date().toISOString(), status: "arquivada" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Função excluída");
      qc.invalidateQueries({ queryKey: ["cargos-funcoes-consolidado"] });
    },
  });

  const exportCSV = () => {
    if (!rawData) return;
    const headers = ["Cargo", "Código Cargo", "CBO", "Nível", "Função", "Código Função", "% Gratificação"];
    const rows = rawData.flatMap(c => {
      if (!c.funcoes?.length) return [[c.nome, c.codigo || "", c.cbo || "", c.nivel || "", "", "", ""]];
      return c.funcoes.map(f => [
        c.nome, c.codigo || "", c.cbo || "", c.nivel || "",
        f.nome, f.codigo || "", f.gratificacao_percentual !== null ? `${f.gratificacao_percentual}%` : "0%"
      ]);
    });
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cargos-funcoes-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (userLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  if (!isMaster) return (
    <div className="mx-auto max-w-2xl rounded-lg border bg-card p-8 text-center">
      <h1 className="text-lg font-semibold">Acesso restrito</h1>
      <p className="mt-2 text-sm text-muted-foreground">Apenas usuários Master podem gerenciar cargos e funções.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Cargos e Funções</h1>
          <p className="text-sm text-muted-foreground">
            Base utilizada no cadastro de profissionais. Itens em uso não podem ser excluídos — apenas inativados.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button 
              disabled={filtro === 'funcoes'}
              onClick={() => {
                setEditingCargo(null);
                cargoForm.reset({ nome: "", codigo: null, cbo: null, nivel: null, area_profissional: "Outros", exige_conselho: false });
                setCargoDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Novo Cargo
            </Button>
            <Button 
              variant="outline" 
              disabled={filtro === 'cargos'}
              onClick={() => {
                setEditingFuncao(null);
                funcaoForm.reset({ nome: "", codigo: null, gratificacao_percentual: 0, cargo_id: selectedCargoId || null });
                setFuncaoDialogOpen(true);
              }}
            >
              <Plus className="mr-1 h-4 w-4" /> Nova Função
            </Button>
            <Button variant="ghost" onClick={exportCSV}>
              <Download className="mr-1 h-4 w-4" /> Exportar
            </Button>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder={filtro === 'cargos' ? "Buscar cargos..." : filtro === 'funcoes' ? "Buscar funções..." : "Buscar por nome ou CBO..."} 
              className="pl-9"
              value={searchParam}
              onChange={(e) => nav({ search: { search: e.target.value } })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">Filtros:</span>
          <Button 
            variant={filtro === 'todos' ? "default" : "outline"} 
            size="sm" 
            className="h-8"
            onClick={() => {
              setFiltro('todos');
              setExpandedCargos(new Set());
            }}
          >
            Todos
          </Button>
          <Button 
            variant={filtro === 'cargos' ? "default" : "outline"} 
            size="sm" 
            className="h-8"
            onClick={() => {
              setFiltro('cargos');
              setExpandedCargos(new Set());
            }}
          >
            Apenas Cargos
          </Button>
          <Button 
            variant={filtro === 'funcoes' ? "default" : "outline"} 
            size="sm" 
            className="h-8"
            onClick={() => {
              setFiltro('funcoes');
              setExpandedCargos(new Set());
            }}
          >
            Apenas Funções
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="p-3 w-8"></th>
              <th className="p-3">Cargo / Função</th>
              <th className="p-3">CBO</th>
              <th className="p-3">Nível</th>
              {filtro === 'funcoes' && <th className="p-3">Cargo Vinculado</th>}
              <th className="p-3">Em Uso</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={filtro === 'funcoes' ? 7 : 6} className="p-8 text-center text-muted-foreground italic">Carregando dados...</td></tr>
            ) : pagedData.length === 0 ? (
              <tr><td colSpan={filtro === 'funcoes' ? 7 : 6} className="p-8 text-center text-muted-foreground italic">Nenhum registro encontrado.</td></tr>
            ) : (filtro === 'funcoes' ? (pagedData as (Funcao & { cargo_nome: string, cargo_uso: number })[]) : (pagedData as Cargo[])).map((item) => {
              if (filtro === 'funcoes') {
                const funcao = item as (Funcao & { cargo_nome: string, cargo_uso: number });
                const funcUso = uso.funcoes[funcao.id] || 0;
                return (
                  <tr key={funcao.id} className="border-t group hover:bg-accent/5 transition-colors">
                    <td className="p-3"></td>
                    <td className="p-3 font-medium text-slate-900">{funcao.nome}</td>
                    <td className="p-3 text-muted-foreground">—</td>
                    <td className="p-3">—</td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-normal">{funcao.cargo_nome}</Badge>
                    </td>
                    <td className="p-3">
                      {funcUso > 0 ? <Badge variant="secondary">{funcUso}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                        setEditingFuncao(funcao);
                        funcaoForm.reset({
                          nome: funcao.nome,
                          codigo: funcao.codigo,
                          gratificacao_percentual: funcao.gratificacao_percentual,
                          cargo_id: funcao.cargo_id
                        });
                        setFuncaoDialogOpen(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                                disabled={funcUso > 0}
                                onClick={() => {
                                  if (window.confirm(`Excluir a função ${funcao.nome}?`))
                                    deleteFuncaoMut.mutate(funcao.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {funcUso > 0 && (
                            <TooltipContent>Função em uso. Inative ao invés de excluir.</TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  </tr>
                );
              }

              const cargo = item as Cargo;
              const isExpanded = expandedCargos.has(cargo.id);
              const cargoUso = uso.cargos[cargo.id] || 0;
              
              return (
                <TooltipProvider key={cargo.id}>
                  <tr className="border-t group hover:bg-accent/5 transition-colors">
                    <td className="p-3">
                      {filtro === 'todos' && cargo.funcoes && cargo.funcoes.length > 0 ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCargo(cargo.id);
                          }} 
                          className="hover:text-primary transition-colors p-1"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      ) : (
                        <div className="w-6" />
                      )}
                    </td>
                    <td className="p-3 font-bold text-slate-900">{cargo.nome}</td>
                    <td className="p-3 text-muted-foreground">{cargo.cbo || "—"}</td>
                    <td className="p-3 capitalize">{cargo.nivel || "—"}</td>
                    <td className="p-3">
                      {cargoUso > 0 ? <Badge variant="secondary">{cargoUso}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => {
                        setEditingCargo(cargo);
                        cargoForm.reset({
                          nome: cargo.nome,
                          codigo: cargo.codigo,
                          cbo: cargo.cbo,
                          nivel: cargo.nivel,
                          area_profissional: cargo.area_profissional,
                          exige_conselho: cargo.exige_conselho
                        });
                        setCargoDialogOpen(true);
                      }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" 
                              disabled={cargoUso > 0}
                              onClick={() => {
                                if (window.confirm(`Deseja realmente excluir o cargo ${cargo.nome}?`))
                                  deleteCargoMut.mutate(cargo.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {cargoUso > 0 && (
                          <TooltipContent>Não pode deletar. {cargoUso} profissionais vinculados.</TooltipContent>
                        )}
                      </Tooltip>
                    </td>
                  </tr>
                  {filtro === 'todos' && isExpanded && cargo.funcoes?.map(funcao => {
                    const funcUso = uso.funcoes[funcao.id] || 0;
                    return (
                      <tr key={funcao.id} className="bg-muted/20 border-t border-muted/50 text-xs">
                        <td></td>
                        <td className="p-2 pl-[24px] flex items-center gap-2 text-slate-500 font-medium">
                          <span className="text-slate-300">└─</span> {funcao.nome}
                        </td>
                        <td className="p-2 text-muted-foreground/60">—</td>
                        <td className="p-2 text-muted-foreground/60">—</td>
                        <td className="p-2">
                          {funcUso > 0 ? <Badge variant="outline" className="text-[10px] py-0">{funcUso}</Badge> : "—"}
                        </td>
                        <td className="p-2 text-right space-x-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                            setEditingFuncao(funcao);
                            funcaoForm.reset({
                              nome: funcao.nome,
                              codigo: funcao.codigo,
                              gratificacao_percentual: funcao.gratificacao_percentual,
                              cargo_id: funcao.cargo_id
                            });
                            setFuncaoDialogOpen(true);
                          }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-6 w-6 text-destructive/70 hover:text-destructive hover:bg-destructive/10" 
                                  disabled={funcUso > 0}
                                  onClick={() => {
                                    if (window.confirm(`Excluir a função ${funcao.nome}?`))
                                      deleteFuncaoMut.mutate(funcao.id);
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {funcUso > 0 && (
                              <TooltipContent>Função em uso. Inative ao invés de excluir.</TooltipContent>
                            )}
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </TooltipProvider>
              );
            })}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-muted/20 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {Math.min(filteredData.length, itemsPerPage)} de {filteredData.length} registros
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={(filtro === 'funcoes' ? fPage : cPage) <= 1}
                onClick={() => handlePageChange((filtro === 'funcoes' ? fPage : cPage) - 1)}
              >
                Anterior
              </Button>
              <div className="flex items-center px-4 text-sm font-medium">
                Página {filtro === 'funcoes' ? fPage : cPage} de {totalPages}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={(filtro === 'funcoes' ? fPage : cPage) >= totalPages}
                onClick={() => handlePageChange((filtro === 'funcoes' ? fPage : cPage) + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={cargoDialogOpen} onOpenChange={setCargoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingCargo ? "Editar Cargo" : "Novo Cargo"}</DialogTitle></DialogHeader>
          <form onSubmit={cargoForm.handleSubmit(v => saveCargoMut.mutate(v))} className="grid gap-4">
            <div>
              <Label>Nome *</Label>
              <Input {...cargoForm.register("nome")} />
              <FormError field="nome" errors={cargoForm.formState.errors} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input 
                  value={cargoForm.watch("codigo") || ""} 
                  onChange={e => cargoForm.setValue("codigo", e.target.value || null)} 
                />
              </div>
              <div>
                <Label>CBO</Label>
                <Input 
                  {...cargoForm.register("cbo")} 
                  placeholder="000.000" 
                  onChange={e => cargoForm.setValue("cbo", maskCBO(e.target.value), { shouldValidate: true })} 
                />
                <FormError field="cbo" errors={cargoForm.formState.errors} />
              </div>
            </div>
            <div>
              <Label>Nível *</Label>
              <Select value={cargoForm.watch("nivel") || ""} onValueChange={v => cargoForm.setValue("nivel", v as any, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{NIVEIS.map(n => <SelectItem key={n.v} value={n.v}>{n.l}</SelectItem>)}</SelectContent>
              </Select>
              <FormError field="nivel" errors={cargoForm.formState.errors} />
            </div>
            <div>
              <Label>Área Profissional *</Label>
              <Select value={cargoForm.watch("area_profissional") || ""} onValueChange={v => cargoForm.setValue("area_profissional", v as any, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{AREAS_PROFISSIONAIS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <FormError field="area_profissional" errors={cargoForm.formState.errors} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={cargoForm.watch("exige_conselho")} onCheckedChange={v => cargoForm.setValue("exige_conselho", v === true)} />
              <Label className="text-sm font-normal">Exige registro em conselho profissional</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCargoDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveCargoMut.isPending}>{saveCargoMut.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={funcaoDialogOpen} onOpenChange={setFuncaoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingFuncao ? "Editar Função" : "Nova Função"}</DialogTitle></DialogHeader>
          <form onSubmit={funcaoForm.handleSubmit(v => saveFuncaoMut.mutate(v))} className="grid gap-4">
            <div>
              <Label>Nome *</Label>
              <Input {...funcaoForm.register("nome")} />
              <FormError field="nome" errors={funcaoForm.formState.errors} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código</Label>
                <Input 
                  value={funcaoForm.watch("codigo") || ""} 
                  onChange={e => funcaoForm.setValue("codigo", e.target.value || null)} 
                />
              </div>
              <div>
                <Label>% Gratificação</Label>
                <Input 
                  value={funcaoForm.watch("gratificacao_percentual") || 0} 
                  onChange={e => {
                    const masked = maskGratificacao(e.target.value);
                    funcaoForm.setValue("gratificacao_percentual", parseFloat(masked) || 0, { shouldValidate: true });
                  }} 
                />
              </div>
            </div>
            <div>
              <Label>Cargo Relacionado *</Label>
              <Select value={funcaoForm.watch("cargo_id") || ""} onValueChange={v => {
                funcaoForm.setValue("cargo_id", v, { shouldValidate: true });
                setSelectedCargoId(v);
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                <SelectContent>
                  {rawData?.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <FormError field="cargo_id" errors={funcaoForm.formState.errors} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFuncaoDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveFuncaoMut.isPending}>{saveFuncaoMut.isPending ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
