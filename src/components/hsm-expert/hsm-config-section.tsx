import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  getHsmConfig,
  listarCatalogoFerramentasHSM,
  salvarHsmConfig,
  type HsmConfigPublica,
  type ToolCatalogItem,
} from "@/lib/hsm-config.functions";
import { HSM_CONFIG_PADRAO } from "@/lib/hsm/config";
import { HSM_AGENTES } from "@/lib/hsm/agentes";
import { HsmEstatisticas } from "./hsm-estatisticas";

type FormState = HsmConfigPublica;

export function HsmConfigSection() {
  const qc = useQueryClient();
  const carregar = useServerFn(getHsmConfig);
  const salvar = useServerFn(salvarHsmConfig);
  const listarCatalogo = useServerFn(listarCatalogoFerramentasHSM);
  const [form, setForm] = useState<FormState>(HSM_CONFIG_PADRAO);

  const config = useQuery({
    queryKey: ["hsm-config"],
    queryFn: async () => (await carregar()) as HsmConfigPublica,
  });

  const catalogo = useQuery({
    queryKey: ["hsm-tool-catalog"],
    queryFn: async () => (await listarCatalogo()) as ToolCatalogItem[],
  });

  useEffect(() => {
    if (config.data) setForm(config.data);
  }, [config.data]);

  const nomesFerramentas = useMemo(
    () => (catalogo.data ?? []).map((f) => f.nome).sort((a, b) => a.localeCompare(b)),
    [catalogo.data],
  );

  const salvarMutation = useMutation({
    mutationFn: async () => (await salvar({ data: form })) as HsmConfigPublica,
    onSuccess: (novo) => {
      setForm(novo);
      toast.success("Configuração do HSM Expert salva.");
      qc.invalidateQueries({ queryKey: ["hsm-config"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao salvar o HSM Expert."),
  });

  const todasSelecionadas = form.ferramentas_habilitadas.length === 0;
  const todosAgentes = form.agentes_habilitados.length === 0;

  function alternarAgente(slug: string, ativo: boolean) {
    setForm((atual) => {
      const todos = HSM_AGENTES.map((a) => a.slug);
      const base = atual.agentes_habilitados.length === 0 ? todos : atual.agentes_habilitados;
      const lista = ativo ? Array.from(new Set([...base, slug])) : base.filter((s) => s !== slug);
      return { ...atual, agentes_habilitados: lista.length === todos.length ? [] : lista };
    });
  }

  function alternarFerramenta(nome: string, checked: boolean) {
    setForm((atual) => {
      const base = atual.ferramentas_habilitadas.length === 0 ? nomesFerramentas : atual.ferramentas_habilitadas;
      const set = new Set(base);
      if (checked) set.add(nome);
      else set.delete(nome);
      const lista = [...set].sort((a, b) => a.localeCompare(b));
      return { ...atual, ferramentas_habilitadas: lista.length === nomesFerramentas.length ? [] : lista };
    });
  }

  if (config.isLoading || catalogo.isLoading) {
    return (
      <section className="space-y-3 rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">Carregando configuração do HSM Expert...</p>
      </section>
    );
  }

  if (config.isError || catalogo.isError) {
    return (
      <section className="space-y-3 rounded-lg border bg-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">HSM Expert</h2>
        <p className="text-sm text-destructive">Não foi possível carregar a configuração do HSM Expert.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-lg border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">HSM Expert</h2>
            <p className="text-sm text-muted-foreground">Governança, ferramentas e limites da IA corporativa.</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> RLS e confirmação humana
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
          />
          <span>
            <span className="block text-sm font-medium">HSM Expert ativo</span>
            <span className="text-xs text-muted-foreground">Desligar pausa novas respostas da IA.</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={form.somente_leitura}
            onChange={(e) =>
              setForm({
                ...form,
                somente_leitura: e.target.checked,
                modo_execucao: e.target.checked ? "somente_leitura" : "assistido",
              })
            }
          />
          <span>
            <span className="block text-sm font-medium">Somente leitura</span>
            <span className="text-xs text-muted-foreground">Bloqueia ferramentas que alteram dados.</span>
          </span>
        </label>
        <div>
          <Label>Modo de execução</Label>
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
            value={form.modo_execucao}
            onChange={(e) =>
              setForm({
                ...form,
                modo_execucao: e.target.value as FormState["modo_execucao"],
                somente_leitura: e.target.value === "somente_leitura",
              })
            }
          >
            <option value="assistido">Assistido</option>
            <option value="somente_leitura">Somente leitura</option>
            <option value="autonomo_controlado">Autônomo controlado</option>
          </select>
        </div>
      </div>

      <div>
        <Label>Prompt institucional do HSM Expert</Label>
        <Textarea
          rows={5}
          value={form.prompt_sistema}
          onChange={(e) => setForm({ ...form, prompt_sistema: e.target.value })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <Label>Mensagens/minuto</Label>
          <Input
            type="number"
            min={1}
            max={120}
            value={form.limites.mensagens_por_minuto}
            onChange={(e) =>
              setForm({
                ...form,
                limites: { ...form.limites, mensagens_por_minuto: Number(e.target.value) || 1 },
              })
            }
          />
        </div>
        <div>
          <Label>Mensagens/dia</Label>
          <Input
            type="number"
            min={10}
            max={5000}
            value={form.limites.mensagens_por_dia}
            onChange={(e) =>
              setForm({
                ...form,
                limites: { ...form.limites, mensagens_por_dia: Number(e.target.value) || 10 },
              })
            }
          />
        </div>
        <div>
          <Label>Ferramentas/mensagem</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.limites.ferramentas_por_mensagem}
            onChange={(e) =>
              setForm({
                ...form,
                limites: { ...form.limites, ferramentas_por_mensagem: Number(e.target.value) || 1 },
              })
            }
          />
        </div>
        <div>
          <Label>Tempo máximo (ms)</Label>
          <Input
            type="number"
            min={10000}
            step={1000}
            value={form.limites.tempo_maximo_ms}
            onChange={(e) =>
              setForm({
                ...form,
                limites: { ...form.limites, tempo_maximo_ms: Number(e.target.value) || 10000 },
              })
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-start gap-3 rounded-md border p-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={form.cache_config.habilitado}
            onChange={(e) =>
              setForm({ ...form, cache_config: { ...form.cache_config, habilitado: e.target.checked } })
            }
          />
          <span>
            <span className="block text-sm font-medium">Cache seguro</span>
            <span className="text-xs text-muted-foreground">Usa chave isolada por usuário e permissões.</span>
          </span>
        </label>
        <div>
          <Label>TTL do cache (segundos)</Label>
          <Input
            type="number"
            min={30}
            max={86400}
            value={form.cache_config.ttl_segundos}
            onChange={(e) =>
              setForm({
                ...form,
                cache_config: { ...form.cache_config, ttl_segundos: Number(e.target.value) || 30 },
              })
            }
          />
        </div>
        <div>
          <Label>Retenção de mensagens (dias)</Label>
          <Input
            type="number"
            min={1}
            max={3650}
            value={form.retencao_config.mensagens_dias}
            onChange={(e) =>
              setForm({
                ...form,
                retencao_config: { ...form.retencao_config, mensagens_dias: Number(e.target.value) || 1 },
              })
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label>Ferramentas habilitadas</Label>
            <p className="text-xs text-muted-foreground">
              Lista vazia significa todas as ferramentas permitidas pelo perfil do usuário.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setForm({ ...form, ferramentas_habilitadas: [] })}>
            Habilitar todas
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {(catalogo.data ?? []).map((f) => (
            <label key={f.nome} className="flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={todasSelecionadas || form.ferramentas_habilitadas.includes(f.nome)}
                onChange={(e) => alternarFerramenta(f.nome, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {f.nome}
                  {f.mutacao ? <Badge variant="destructive">altera dados</Badge> : <Badge variant="secondary">consulta</Badge>}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{f.descricao}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Label>Agentes especializados</Label>
            <p className="text-xs text-muted-foreground">
              Cada agente recorta o foco do assistente e as ferramentas oferecidas. Lista vazia
              habilita todos.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setForm({ ...form, agentes_habilitados: [] })}>
            Habilitar todos
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {HSM_AGENTES.map((a) => (
            <label key={a.slug} className="flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                disabled={a.slug === "geral"}
                checked={a.slug === "geral" || todosAgentes || form.agentes_habilitados.includes(a.slug)}
                onChange={(e) => alternarAgente(a.slug, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{a.nome}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{a.descricao}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <HsmEstatisticas />

      <div className="flex justify-end">
        <Button onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {salvarMutation.isPending ? "Salvando HSM..." : "Salvar HSM Expert"}
        </Button>
      </div>
    </section>
  );
}
